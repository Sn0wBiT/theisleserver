import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, "..", "sql", "001_initial.sql"), "utf8");

function splitQuestKey(key) {
  const parts = String(key).split(":");
  return {
    steam: parts.shift(),
    window: parts.pop(),
    questId: parts.join(":")
  };
}

export class PostgresStore {
  constructor(pool, snapshotFlushMs = 5000) {
    this.pool = pool;
    this.snapshotFlushMs = Math.max(250, Number(snapshotFlushMs) || 5000);
    this.snapshotTimer = null;
    this.dirtySnapshots = new Map();
    this.pending = Promise.resolve();
    this.data = {
      questProgress: {},
      tokenBalances: {},
      lastSnapshots: {}
    };
  }

  static async connect(options) {
    const pool = new pg.Pool({
      connectionString: options.connectionString,
      max: Math.max(1, Number(options.poolSize) || 10),
      connectionTimeoutMillis: 5000
    });
    const store = new PostgresStore(pool, options.snapshotFlushMs);
    await store.initialize(options.importStateFile);
    return store;
  }

  async initialize(importStateFile) {
    await this.pool.query(schema);
    await this.importJsonOnce(importStateFile);

    const [quests, balances, snapshots] = await Promise.all([
      this.pool.query("SELECT steam_id, quest_id, window_key, accepted, progress, completed, claimed FROM tpn_quest_progress"),
      this.pool.query("SELECT steam_id, balance FROM tpn_token_balances"),
      this.pool.query(
        `SELECT DISTINCT ON (steam_id)
           steam_id, dinosaur_id, snapshot_at, hp, pawn_address, species, growth
         FROM tpn_dinosaurs
         ORDER BY steam_id, is_active DESC, snapshot_at DESC`
      )
    ]);

    for (const row of quests.rows) {
      this.data.questProgress[`${row.steam_id}:${row.quest_id}:${row.window_key}`] = {
        accepted: row.accepted,
        progress: Number(row.progress),
        completed: row.completed,
        claimed: row.claimed
      };
    }
    for (const row of balances.rows) this.data.tokenBalances[row.steam_id] = Number(row.balance);
    for (const row of snapshots.rows) {
      this.data.lastSnapshots[row.steam_id] = {
        ts: Number(row.snapshot_at),
        dinosaurId: row.dinosaur_id,
        hp: row.hp === null ? null : Number(row.hp),
        addr: row.pawn_address,
        species: row.species,
        growth: row.growth === null ? null : Number(row.growth)
      };
    }
  }

  async importJsonOnce(file) {
    if (!file || !fs.existsSync(file)) return;
    const marker = await this.pool.query("SELECT 1 FROM tpn_bridge_meta WHERE key = 'json_import_complete'");
    if (marker.rowCount) return;

    const legacy = JSON.parse(fs.readFileSync(file, "utf8"));
    this.data = {
      questProgress: legacy.questProgress || {},
      tokenBalances: legacy.tokenBalances || {},
      lastSnapshots: legacy.lastSnapshots || {}
    };
    await this.persistAll();
    await this.pool.query(
      "INSERT INTO tpn_bridge_meta (key, value) VALUES ('json_import_complete', $1) ON CONFLICT (key) DO NOTHING",
      [new Date().toISOString()]
    );
    console.log(`[store] imported legacy JSON state from ${file}`);
  }

  enqueue(operation) {
    this.pending = this.pending.then(operation).catch((error) => {
      console.error("[store] PostgreSQL write failed", error);
    });
    return this.pending;
  }

  saveSnapshot(steam, snapshot) {
    const dinosaurId = snapshot?.dinosaurId || "legacy";
    this.dirtySnapshots.set(`${steam}:${dinosaurId}`, { steam, ...snapshot });
    if (!this.snapshotTimer) {
      this.snapshotTimer = setTimeout(() => this.flushSnapshots(), this.snapshotFlushMs);
      this.snapshotTimer.unref?.();
    }
  }

  saveQuest(key) {
    const state = this.data.questProgress[key];
    if (!state) return;
    const { steam, questId, window } = splitQuestKey(key);
    this.enqueue(() => this.upsertQuest(steam, questId, window, state));
  }

  saveClaim(key, steam) {
    const state = { ...this.data.questProgress[key] };
    const balance = Number(this.data.tokenBalances[steam] || 0);
    const parsed = splitQuestKey(key);
    this.enqueue(async () => {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await this.upsertQuest(parsed.steam, parsed.questId, parsed.window, state, client);
        await client.query(
          "INSERT INTO tpn_token_balances (steam_id, balance) VALUES ($1, $2) ON CONFLICT (steam_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = now()",
          [steam, balance]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    });
  }

  upsertQuest(steam, questId, window, state, executor = this.pool) {
    return executor.query(
      `INSERT INTO tpn_quest_progress
        (steam_id, quest_id, window_key, accepted, progress, completed, claimed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (steam_id, quest_id, window_key) DO UPDATE SET
         accepted = EXCLUDED.accepted, progress = EXCLUDED.progress,
         completed = EXCLUDED.completed, claimed = EXCLUDED.claimed, updated_at = now()`,
      [steam, questId, window, state.accepted, Number(state.progress || 0), state.completed, state.claimed]
    );
  }

  flushSnapshots() {
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = null;
    const rows = [...this.dirtySnapshots.values()].filter((row) => row.steam);
    this.dirtySnapshots.clear();
    if (!rows.length) return this.pending;
    return this.enqueue(() => this.upsertSnapshots(rows));
  }

  upsertSnapshots(rows, executor = this.pool) {
    return executor.query(
      `WITH payload AS (
         SELECT steam, COALESCE(NULLIF(dinosaur_id, ''), 'legacy') AS dinosaur_id,
                ts, hp, addr, species, growth
         FROM json_to_recordset($1::json) AS x(
           steam text, dinosaur_id text, ts bigint, hp double precision,
           addr text, species text, growth double precision
         )
       ), players AS (
         INSERT INTO tpn_players (steam_id)
         SELECT DISTINCT steam FROM payload
         ON CONFLICT (steam_id) DO UPDATE SET updated_at = now()
       ), inactive AS (
         UPDATE tpn_dinosaurs SET is_active = false, updated_at = now()
         WHERE steam_id IN (SELECT steam FROM payload)
       ), ranked AS (
         SELECT *, row_number() OVER (
           PARTITION BY steam ORDER BY ts DESC, dinosaur_id
         ) = 1 AS is_active
         FROM payload
       )
       INSERT INTO tpn_dinosaurs
         (steam_id, dinosaur_id, snapshot_at, hp, pawn_address, species, growth, is_active)
       SELECT steam, dinosaur_id, ts, hp, addr, species, growth, is_active FROM ranked
       ON CONFLICT (steam_id, dinosaur_id) DO UPDATE SET
         snapshot_at = EXCLUDED.snapshot_at, hp = EXCLUDED.hp,
         pawn_address = EXCLUDED.pawn_address, species = EXCLUDED.species,
         growth = EXCLUDED.growth, is_active = true, updated_at = now()`,
      [JSON.stringify(rows.map((row) => ({ ...row, dinosaur_id: row.dinosaurId })))]
    );
  }

  async persistAll() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const snapshots = Object.entries(this.data.lastSnapshots).map(([steam, value]) => ({ steam, ...value }));
      if (snapshots.length) await this.upsertSnapshots(snapshots, client);
      for (const [key, state] of Object.entries(this.data.questProgress)) {
        const { steam, questId, window } = splitQuestKey(key);
        await this.upsertQuest(steam, questId, window, state, client);
      }
      for (const [steam, balance] of Object.entries(this.data.tokenBalances)) {
        await client.query(
          "INSERT INTO tpn_token_balances (steam_id, balance) VALUES ($1, $2) ON CONFLICT (steam_id) DO UPDATE SET balance = EXCLUDED.balance, updated_at = now()",
          [steam, Number(balance)]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  batch(callback) {
    return callback();
  }

  async close() {
    await this.flushSnapshots();
    await this.pending;
    await this.pool.end();
  }
}
