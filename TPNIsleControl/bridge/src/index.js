import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { JsonStore } from "./store.js";
import { PostgresStore } from "./postgres-store.js";
import { QuestEngine } from "./quest-engine.js";
import { formatQuestMessages } from "./quest-message.js";
import { formatHelpMessage } from "./help-message.js";
import { completeNdjsonChunk } from "./ndjson.js";
import { parseGameSync, PendingCommandQueue } from "./game-sync.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const bridgeDir = path.resolve(here, "..");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const configPath = process.env.TPNISLECONTROL_CONFIG || path.join(bridgeDir, "config.json");
if (!fs.existsSync(configPath)) {
  console.error("Missing bridge/config.json. Copy config.example.json first.");
  process.exit(1);
}

const config = readJson(configPath);
const quests = readJson(path.join(bridgeDir, "quests.json"));
const aiDinosaurSpecies = new Set(readJson(path.join(bridgeDir, "ai-dinosaurs.json"))
  .map((species) => String(species).toLowerCase()));
const stateFile = config.stateFile || path.join(bridgeDir, "data", "state.json");
const storage = String(config.storage || "json").toLowerCase();
let store;

if (storage === "postgres") {
  const connectionString = process.env.TPNISLECONTROL_DATABASE_URL || config.databaseUrl;
  if (!connectionString) {
    console.error("PostgreSQL storage requires TPNISLECONTROL_DATABASE_URL or config.databaseUrl.");
    process.exit(1);
  }
  store = await PostgresStore.connect({
    connectionString,
    poolSize: config.databasePoolSize,
    snapshotFlushMs: config.snapshotFlushMs,
    importStateFile: stateFile
  });
  console.log("[store] PostgreSQL connected");
} else if (storage === "json") {
  store = new JsonStore(stateFile);
  console.log(`[store] JSON state: ${stateFile}`);
} else {
  console.error(`Unsupported storage backend: ${storage}`);
  process.exit(1);
}
const questEngine = new QuestEngine(quests, store);

const eventsPath = path.join(config.modSavedDir, "events.ndjson");
const nativeEventsPath = path.join(config.modSavedDir, "native-events.ndjson");
const commandsPath = path.join(config.modSavedDir, "commands.ndjson");
const resultsPath = path.join(config.modSavedDir, "results.ndjson");

fs.mkdirSync(config.modSavedDir, { recursive: true });

const cursors = new Map();
const livePlayers = new Map(); // steam -> latest snapshot
const addrToSteam = new Map(); // pawn address -> steam
const recentDamage = new Map(); // victim address -> { attackerAddr, ts }
const recentAiDeaths = new Map(); // AI address -> death timestamp
const pendingHttpCommands = new PendingCommandQueue();
let lastHttpSyncAt = 0;

// Persistent quest state already contains everything represented by old IPC
// records. Begin existing append-only files at EOF so a bridge restart cannot
// award progress twice. Files created after startup still begin at byte zero.
for (const file of [eventsPath, nativeEventsPath]) {
  if (fs.existsSync(file)) cursors.set(file, fs.statSync(file).size);
}

function tail(file, onLine) {
  if (!fs.existsSync(file)) return;

  const stat = fs.statSync(file);
  let cursor = cursors.get(file) ?? 0;

  if (stat.size < cursor) cursor = 0;
  if (stat.size === cursor) return;

  const fd = fs.openSync(file, "r");
  const len = stat.size - cursor;
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, cursor);
  fs.closeSync(fd);

  // The Lua writer may still be appending the final record. Advance only over
  // newline-terminated bytes so that an incomplete record is read again on the
  // next poll instead of being parsed and then permanently skipped.
  const chunk = completeNdjsonChunk(buf);
  if (chunk.bytesConsumed === 0) return;

  cursors.set(file, cursor + chunk.bytesConsumed);

  for (const line of chunk.lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      console.warn("[tail] ignored malformed line", file, line.slice(0, 120));
      continue;
    }

    try {
      onLine(event);
    } catch (error) {
      console.error("[tail] event handler failed", file, event?.type, error);
    }
  }
}

function processSnapshot(s) {
  if (!s?.steam) return;

  const previous = livePlayers.get(s.steam);

  livePlayers.set(s.steam, {
    ...s,
    positionUpdatedAt: s?.pos ? Date.now() : previous?.positionUpdatedAt
  });

  if (s.addr) {
    addrToSteam.set(String(s.addr).toLowerCase(), s.steam);
  }

  questEngine.onSnapshot(s);

  const oldHp = Number(previous?.vitals?.hp);
  const newHp = Number(s?.vitals?.hp);

  if (
    previous &&
    Number.isFinite(oldHp) &&
    Number.isFinite(newHp) &&
    oldHp > 0 &&
    newHp <= 0 &&
    s.addr
  ) {
    const victimAddr = String(s.addr).toLowerCase();
    const hit = recentDamage.get(victimAddr);

    if (hit && Number(s.ts || 0) - hit.ts <= Number(config.combatWindowSec || 20)) {
      const killerSteam = addrToSteam.get(hit.attackerAddr);
      const victimSteam = s.steam;

      if (killerSteam && killerSteam !== victimSteam) {
        console.log(`[kill] ${killerSteam} -> ${victimSteam}`);
        questEngine.onPlayerKill(killerSteam);
      }
    }
  }
}

function processPosition(update) {
  const steam = String(update?.steam || "");
  const x = Number(update?.pos?.x);
  const y = Number(update?.pos?.y);
  const z = Number(update?.pos?.z);
  if (!steam || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;

  livePlayers.set(steam, {
    ...(livePlayers.get(steam) || { steam }),
    pos: { x, y, z },
    positionUpdatedAt: Date.now()
  });
}

function processNativeEvent(e) {
  if (e?.type === "ai_dinosaur_death") {
    const targetAddr = String(e.target_addr || "").toLowerCase();
    const targetSpecies = String(e.target_species || "").toLowerCase();
    const ts = Number(e.ts || 0);
    const approvedSpecies = [...aiDinosaurSpecies].some((species) => targetSpecies.includes(species));
    if (!targetAddr || !ts || !approvedSpecies || addrToSteam.has(targetAddr)) return;
    if ((recentAiDeaths.get(targetAddr) || 0) >= ts - 60) return;

    const hit = recentDamage.get(targetAddr);
    if (!hit || ts - hit.ts > Number(config.combatWindowSec || 20)) return;
    const killerSteam = addrToSteam.get(hit.attackerAddr);
    if (!killerSteam) return;

    recentAiDeaths.set(targetAddr, ts);
    questEngine.onAiDinosaurKill(killerSteam, targetSpecies);
    console.log(`[ai-kill] ${killerSteam} -> ${targetAddr}`);
    return;
  }

  if (e?.type !== "damage_hit") return;

  const attackerAddr = String(e.attacker_addr || "").toLowerCase();
  const targetAddr = String(e.target_addr || "").toLowerCase();
  const ts = Number(e.ts || 0);

  if (!attackerAddr || !targetAddr || !ts) return;

  recentDamage.set(targetAddr, { attackerAddr, ts });

  // Small cleanup.
  const cutoff = Math.floor(Date.now() / 1000) - 60;
  for (const [key, value] of recentDamage) {
    if (value.ts < cutoff) recentDamage.delete(key);
  }
  for (const [key, deathTs] of recentAiDeaths) {
    if (deathTs < cutoff) recentAiDeaths.delete(key);
  }
}

function processQuestRequest(e) {
  const steam = String(e?.steam || "");
  const requestedAt = Number(e?.ts || 0);
  const now = Math.floor(Date.now() / 1000);

  if (!steam || !requestedAt) return;

  // events.ndjson is replayed from the beginning after a bridge restart. Do
  // not answer an old chat request when the requesting player reconnects.
  if (requestedAt < now - 30 || requestedAt > now + 5) return;

  const tokenBalance = Number(store.data.tokenBalances[steam] || 0);
  const playerQuests = questEngine.getPlayerState(steam);
  const messages = formatQuestMessages(playerQuests, tokenBalance, 240);
  const requestedPage = Math.floor(Number(e?.page || 1));
  const page = Math.min(messages.length, Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1));
  const navigation = messages.length > 1
    ? ` | Trang ${page}/${messages.length}${page < messages.length ? ` | /quests ${page + 1}` : ""}`
    : "";

  appendCommand({ verb: "notify", steam, args: { message: `${messages[page - 1]}${navigation}` } });
}

function processQuestAccept(e) {
  const steam = String(e?.steam || "");
  const questId = String(e?.questId || "");
  const requestedAt = Number(e?.ts || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!steam || !questId || !requestedAt) return;
  if (requestedAt < now - 30 || requestedAt > now + 5) return;

  const result = questEngine.accept(steam, questId);
  const message = result.ok
    ? `Đã nhận nhiệm vụ: ${questId}. Tiến độ hiện bắt đầu được theo dõi.`
    : result.error === "already-accepted"
      ? `Nhiệm vụ ${questId} đã được nhận.`
      : result.error === "growth-requirement-not-met"
        ? `Không thể nhận nhiệm vụ ${questId}: cần khủng long đạt ${result.requiredGrowth * 100}% tăng trưởng (hiện tại ${result.currentGrowth === null ? "không xác định" : `${Math.floor(result.currentGrowth * 100)}%`}).`
      : `Không thể nhận nhiệm vụ ${questId}: ${result.error}`;
  appendCommand({ verb: "notify", steam, args: { message } });
}

function processHelpRequest(e) {
  const steam = String(e?.steam || "");
  const requestedAt = Number(e?.ts || 0);
  const now = Math.floor(Date.now() / 1000);

  if (!steam || !requestedAt) return;
  if (requestedAt < now - 30 || requestedAt > now + 5) return;

  appendCommand({
    verb: "notify",
    steam,
    args: { message: formatHelpMessage() }
  });
}

function processHumanRequest(e) {
  const steam = String(e?.steam || "");
  const requestedAt = Number(e?.ts || 0);
  const now = Math.floor(Date.now() / 1000);

  if (!steam || !requestedAt) return;
  if (requestedAt < now - 30 || requestedAt > now + 5) return;

  appendCommand({ verb: "human", steam, args: {} });
}

function processReviveRequest(e) {
  const steam = String(e?.steam || "");
  const requestedAt = Number(e?.ts || 0);
  const now = Math.floor(Date.now() / 1000);

  if (!steam || !requestedAt) return;
  if (requestedAt < now - 30 || requestedAt > now + 5) return;

  appendCommand({ verb: "revive", steam, args: {} });
}

setInterval(() => {
  tail(eventsPath, (e) => {
    if (e.type === "snapshot") processSnapshot(e);
    if (e.type === "quest_request") processQuestRequest(e);
    if (e.type === "quest_accept") processQuestAccept(e);
    if (e.type === "help_request") processHelpRequest(e);
    if (e.type === "human_request") processHumanRequest(e);
    if (e.type === "revive_request") processReviveRequest(e);
    if (e.type === "damage_hit" || e.type === "ai_dinosaur_death") processNativeEvent(e);
  });

  tail(nativeEventsPath, processNativeEvent);
}, Math.max(250, Number(config.pollMs || 1000)));

function appendCommand(command) {
  const queued = {
    id: command.id || crypto.randomUUID(),
    ts: Math.floor(Date.now() / 1000),
    verb: command.verb,
    steam: command.steam || "",
    args: command.args || {}
  };

  const httpActive = config.gameTransport === "http" || (
    config.gameTransport === "auto" && Date.now() - lastHttpSyncAt < 30000
  );

  if (httpActive) {
    return pendingHttpCommands.add(queued);
  }

  fs.appendFileSync(commandsPath, JSON.stringify(queued) + "\n");
  return queued;
}

function authorized(req) {
  if (!config.apiToken) return false;
  return req.headers.authorization === `Bearer ${config.apiToken}`;
}

function gameAuthorized(req) {
  if (config.gameToken) {
    return req.headers.authorization === `Bearer ${config.gameToken}`;
  }

  const address = req.socket.remoteAddress || "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function send(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendNdjson(res, status, values) {
  const body = values.map((value) => JSON.stringify(value)).join("\n");
  res.writeHead(status, {
    "content-type": "application/x-ndjson; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });
  res.end(body);
}

function bodyJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("body-too-large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, {
      ok: true,
      players: livePlayers.size,
      storage,
      gameTransport: config.gameTransport || "file",
      httpConnected: Date.now() - lastHttpSyncAt < 15000,
      lastHttpSyncAt: lastHttpSyncAt || null,
      eventsPath,
      nativeEventsPath
    });
  }

  if (req.method === "POST" && url.pathname === "/game/sync") {
    if (!gameAuthorized(req)) {
      return send(res, 401, { ok: false, error: "unauthorized" });
    }

    try {
      const sync = parseGameSync(await bodyJson(req));
      lastHttpSyncAt = Date.now();
      pendingHttpCommands.acknowledge(sync.acknowledgements);

      store.batch(() => {
        for (const snapshot of sync.snapshots) processSnapshot(snapshot);
        for (const position of sync.positions) processPosition(position);
        for (const event of sync.events) {
          if (event?.type === "quest_request") processQuestRequest(event);
          if (event?.type === "quest_accept") processQuestAccept(event);
          if (event?.type === "help_request") processHelpRequest(event);
          if (event?.type === "human_request") processHumanRequest(event);
          if (event?.type === "revive_request") processReviveRequest(event);
          if (event?.type === "damage_hit" || event?.type === "ai_dinosaur_death") processNativeEvent(event);
        }
      });

      return sendNdjson(res, 200, pendingHttpCommands.list());
    } catch (error) {
      return send(res, 400, { ok: false, error: String(error.message || error) });
    }
  }

  if (!authorized(req)) {
    return send(res, 401, { ok: false, error: "unauthorized" });
  }

  if (req.method === "GET" && url.pathname === "/players") {
    return send(res, 200, {
      players: [...livePlayers.values()]
    });
  }

  const questGet = url.pathname.match(/^\/quests\/([^/]+)$/);
  if (req.method === "GET" && questGet) {
    const steam = decodeURIComponent(questGet[1]);
    return send(res, 200, {
      steam,
      tokenBalance: Number(store.data.tokenBalances[steam] || 0),
      currentDinosaur: questEngine.getCurrentDinosaur(steam),
      quests: questEngine.getPlayerState(steam)
    });
  }

  const claim = url.pathname.match(/^\/quests\/([^/]+)\/claim\/([^/]+)$/);
  if (req.method === "POST" && claim) {
    const steam = decodeURIComponent(claim[1]);
    const questId = decodeURIComponent(claim[2]);
    const result = questEngine.claim(steam, questId);

    if (result.ok) {
      appendCommand({
        verb: "notify",
        steam,
        args: {
          message: `Quest completed! +${result.rewardTokens} tokens`
        }
      });
      return send(res, 200, result);
    }

    return send(res, 400, result);
  }

  const accept = url.pathname.match(/^\/quests\/([^/]+)\/accept\/([^/]+)$/);
  if (req.method === "POST" && accept) {
    const steam = decodeURIComponent(accept[1]);
    const questId = decodeURIComponent(accept[2]);
    const result = questEngine.accept(steam, questId);
    return send(res, result.ok ? 200 : 400, result);
  }

  if (req.method === "POST" && url.pathname === "/command") {
    try {
      const input = await bodyJson(req);
      if (!input?.verb) {
        return send(res, 400, { ok: false, error: "verb-required" });
      }

      const queued = appendCommand(input);
      return send(res, 202, { ok: true, queued });
    } catch (error) {
      return send(res, 400, { ok: false, error: String(error) });
    }
  }

  if (req.method === "GET" && url.pathname === "/results") {
    let rows = [];
    try {
      if (fs.existsSync(resultsPath)) {
        rows = fs.readFileSync(resultsPath, "utf8")
          .split(/\r?\n/)
          .filter(Boolean)
          .slice(-100)
          .map((line) => {
            try { return JSON.parse(line); }
            catch { return { malformed: line }; }
          });
      }
    } catch {}
    return send(res, 200, { results: rows });
  }

  return send(res, 404, { ok: false, error: "not-found" });
});

server.listen(Number(config.port || 31990), config.host || "127.0.0.1", () => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : Number(config.port || 31990);
  console.log(
    `[TPNIsleControl bridge] http://${config.host || "127.0.0.1"}:${port}`
  );
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal}; flushing persistent state`);
  try {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await store.close();
    process.exit(0);
  } catch (error) {
    console.error("[shutdown] persistent-state flush failed", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
