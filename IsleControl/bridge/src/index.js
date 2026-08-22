import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { JsonStore } from "./store.js";
import { QuestEngine } from "./quest-engine.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const bridgeDir = path.resolve(here, "..");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const configPath = path.join(bridgeDir, "config.json");
if (!fs.existsSync(configPath)) {
  console.error("Missing bridge/config.json. Copy config.example.json first.");
  process.exit(1);
}

const config = readJson(configPath);
const quests = readJson(path.join(bridgeDir, "quests.json"));
const store = new JsonStore(path.join(bridgeDir, "data", "state.json"));
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

  cursors.set(file, stat.size);

  // NDJSON writers append complete lines. Ignore the final partial line if any.
  const text = buf.toString("utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      onLine(JSON.parse(line));
    } catch {
      console.warn("[tail] ignored malformed line", file, line.slice(0, 120));
    }
  }
}

function processSnapshot(s) {
  if (!s?.steam) return;

  const previous = livePlayers.get(s.steam);

  livePlayers.set(s.steam, s);

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

function processNativeEvent(e) {
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
}

setInterval(() => {
  tail(eventsPath, (e) => {
    if (e.type === "snapshot") processSnapshot(e);
  });

  tail(nativeEventsPath, processNativeEvent);
}, Math.max(250, Number(config.pollMs || 1000)));

function appendCommand(command) {
  const line = JSON.stringify({
    id: command.id || crypto.randomUUID(),
    ts: Math.floor(Date.now() / 1000),
    verb: command.verb,
    steam: command.steam || "",
    args: command.args || {}
  });

  fs.appendFileSync(commandsPath, line + "\n");
  return JSON.parse(line);
}

function authorized(req) {
  if (!config.apiToken) return false;
  return req.headers.authorization === `Bearer ${config.apiToken}`;
}

function send(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
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
      eventsPath,
      nativeEventsPath
    });
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
  console.log(
    `[IsleControl bridge] http://${config.host || "127.0.0.1"}:${config.port || 31990}`
  );
});
