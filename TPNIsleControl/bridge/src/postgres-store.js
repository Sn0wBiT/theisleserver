import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const schema = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sql", "001_initial.sql"), "utf8");

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
    this.dirtyPositions = new Map();
    this.positionTimer = null;
    this.data = {
      questProgress: {},
      tokenBalances: {},
      lastSnapshots: {},
      positions: {}
    };
  }

  static async connect(options) {
    const pool = new pg.Pool({
      connectionString: options.connectionString,
      max: Math.max(1, Number(options.poolSize) || 10),
      connectionTimeoutMillis: 5000
    });
    const store = new PostgresStore(pool, options.snapshotFlushMs);
    await store.initialize();
    return store;
  }

  async initialize() {
    await this.pool.query(schema);

    const [quests, balances, snapshots, positions] = await Promise.all([
      this.pool.query("SELECT steam_id, quest_id, window_key, accepted, progress, completed, claimed FROM tpn_quest_progress"),
      this.pool.query("SELECT steam_id, balance FROM tpn_token_balances"),
      this.pool.query(
        `SELECT DISTINCT ON (steam_id)
           steam_id, dinosaur_id, snapshot_at, hp, pawn_address, species, growth
         FROM tpn_dinosaurs
         ORDER BY steam_id, is_active DESC, snapshot_at DESC`
      ),
      this.pool.query("SELECT steam_id, dinosaur_id, x, y, z, observed_at FROM tpn_dinosaur_positions")
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
    for (const row of positions.rows) {
      this.data.positions[`${row.steam_id}:${row.dinosaur_id}`] = {
        steam: row.steam_id, dinosaurId: row.dinosaur_id, x: Number(row.x), y: Number(row.y), z: Number(row.z), updatedAt: new Date(row.observed_at).getTime()
      };
    }
  }

  async isHealthy() {
    try { await this.pool.query("SELECT 1"); return true; }
    catch { return false; }
  }

  recordTerritoryActivity(activity) {
    const eventId = String(activity.eventId || "");
    const steam = String(activity.steam || "");
    const zoneId = String(activity.zoneId || "");
    const activityType = String(activity.activityType || "");
    const points = Number(activity.points);
    if (!eventId || !steam || !zoneId || !activityType || !Number.isSafeInteger(points) || points <= 0 || points > 10000) {
      return Promise.reject(new Error("invalid-territory-activity"));
    }
    return this.enqueue(async () => {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        const zone = await client.query("SELECT zone_id FROM tpn_territory_zones WHERE zone_id = $1 FOR SHARE", [zoneId]);
        if (!zone.rowCount) throw new Error("zone-not-found");
        const member = await client.query("SELECT faction_id FROM tpn_faction_members WHERE steam_id = $1", [steam]);
        if (!member.rowCount) throw new Error("player-not-in-faction");
        const factionId = member.rows[0].faction_id;
        const inserted = await client.query(`INSERT INTO tpn_territory_influence_events
          (event_id, idempotency_key, steam_id, faction_id, zone_id, activity_type, points, occurred_at, metadata)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, COALESCE(to_timestamp($7), now()), $8)
          ON CONFLICT (idempotency_key) DO NOTHING RETURNING event_id`,
          [eventId, steam, factionId, zoneId, activityType, points, Number(activity.ts) || null, activity.metadata || {}]);
        if (!inserted.rowCount) {
          await client.query("COMMIT");
          return { accepted: false, duplicate: true };
        }
        const state = await client.query(`INSERT INTO tpn_territory_states (zone_id, status, influence)
          VALUES ($1, 'contested', $2)
          ON CONFLICT (zone_id) DO UPDATE SET influence = tpn_territory_states.influence + EXCLUDED.influence,
            status = CASE WHEN tpn_territory_states.owner_faction_id IS NULL THEN 'contested' ELSE tpn_territory_states.status END,
            updated_at = now()
          RETURNING zone_id, status, influence, owner_faction_id, expires_at`, [zoneId, points]);
        let committedState = state.rows[0];
        const threshold = Number(activity.captureThreshold || 100);
        if (!committedState.owner_faction_id && committedState.influence >= threshold) {
          const captured = await client.query(`UPDATE tpn_territory_states SET owner_faction_id = $1,
            status = 'owned', captured_at = now(), expires_at = now() + ($2 * interval '1 hour'), updated_at = now()
            WHERE zone_id = $3 AND owner_faction_id IS NULL
            RETURNING zone_id, status, influence, owner_faction_id, expires_at`, [factionId, Number(activity.ownershipHours || 72), zoneId]);
          if (captured.rowCount) {
            committedState = captured.rows[0];
            await client.query(`INSERT INTO tpn_territory_capture_events
              (event_id, zone_id, faction_id, event_type, metadata) VALUES (gen_random_uuid(), $1, $2, 'capture', $3)`, [zoneId, factionId, { threshold }]);
          }
        }
        await client.query("COMMIT");
        return { accepted: true, duplicate: false, eventId, state: committedState };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    });
  }

  expireTerritories() {
    return this.enqueue(async () => {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        const expired = await client.query(`UPDATE tpn_territory_states SET status = 'expired', owner_faction_id = NULL,
          influence = 0, expires_at = NULL, updated_at = now()
          WHERE status = 'owned' AND expires_at IS NOT NULL AND expires_at <= now()
          RETURNING zone_id`);
        for (const row of expired.rows) {
          await client.query(`INSERT INTO tpn_territory_capture_events
            (event_id, zone_id, event_type, metadata) VALUES (gen_random_uuid(), $1, 'expiration', '{}'::jsonb)`, [row.zone_id]);
        }
        await client.query("COMMIT");
        return expired.rowCount;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    });
  }

  enqueue(operation) {
    this.pending = this.pending.then(operation);
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

  savePosition(steam, position, updatedAt = Date.now()) {
    const dinosaurId = position.dinosaurId || "legacy";
    this.data.positions[`${steam}:${dinosaurId}`] = { steam, ...position, dinosaurId, updatedAt };
    this.dirtyPositions.set(`${steam}:${dinosaurId}`, { steam, ...position, dinosaurId, updatedAt });
    if (!this.positionTimer) {
      this.positionTimer = setTimeout(() => this.flushPositions(), this.snapshotFlushMs);
      this.positionTimer.unref?.();
    }
  }

  flushPositions() {
    if (this.positionTimer) clearTimeout(this.positionTimer);
    this.positionTimer = null;
    const rows = [...this.dirtyPositions.values()];
    this.dirtyPositions.clear();
    if (!rows.length) return this.pending;
    return this.enqueue(() => this.upsertPositions(rows));
  }

  upsertPositions(rows, executor = this.pool) {
    return executor.query(
      `WITH payload AS (SELECT * FROM json_to_recordset($1::json) AS x(steam text, dinosaur_id text, x double precision, y double precision, z double precision, updated_at bigint)), players AS (
         INSERT INTO tpn_players (steam_id, last_seen_at, is_online) SELECT steam, to_timestamp(updated_at / 1000.0), true FROM payload
         ON CONFLICT (steam_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at, is_online = true, updated_at = now()
       ), dinosaurs AS (
         INSERT INTO tpn_dinosaurs (steam_id, dinosaur_id, snapshot_at) SELECT steam, COALESCE(NULLIF(dinosaur_id, ''), 'legacy'), updated_at / 1000 FROM payload
         ON CONFLICT (steam_id, dinosaur_id) DO NOTHING
       ) INSERT INTO tpn_dinosaur_positions (steam_id, dinosaur_id, x, y, z, observed_at)
       SELECT steam, COALESCE(NULLIF(dinosaur_id, ''), 'legacy'), x, y, z, to_timestamp(updated_at / 1000.0) FROM payload
       ON CONFLICT (steam_id, dinosaur_id) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, z = EXCLUDED.z, observed_at = EXCLUDED.observed_at, updated_at = now()`,
      [JSON.stringify(rows)]
    );
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


  batch(callback) {
    return callback();
  }

  async close() {
    await this.flushPositions();
    await this.flushSnapshots();
    await this.pending;
    await this.pool.end();
  }
}
