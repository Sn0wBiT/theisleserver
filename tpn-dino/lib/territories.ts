import "server-only";

import { randomUUID } from "node:crypto";
import { db, transaction } from "./db";

export type Territory = {
  zoneId: string; name: string; polygon: unknown; terrainType: string | null;
  status: string; influence: number; ownerFactionId: string | null;
};

async function ensurePlayer(client: Pick<import("pg").PoolClient, "query">, steamId: string) {
  await client.query("INSERT INTO tpn_players (steam_id) VALUES ($1) ON CONFLICT (steam_id) DO NOTHING", [steamId]);
}

export async function listTerritories(): Promise<Territory[]> {
  const result = await db().query(`SELECT z.zone_id, z.name, z.polygon, z.terrain_type,
    COALESCE(s.status, 'neutral') AS status, COALESCE(s.influence, 0) AS influence,
    s.owner_faction_id
    FROM tpn_territory_zones z LEFT JOIN tpn_territory_states s ON s.zone_id = z.zone_id
    ORDER BY z.zone_id`);
  return result.rows.map((row) => ({ zoneId: row.zone_id, name: row.name, polygon: row.polygon,
    terrainType: row.terrain_type, status: row.status, influence: Number(row.influence),
    ownerFactionId: row.owner_faction_id }));
}

export async function territoryHistory(zoneId: string) {
  const result = await db().query(`SELECT event_id, faction_id, previous_faction_id, event_type,
    occurred_at, metadata FROM tpn_territory_capture_events WHERE zone_id = $1
    ORDER BY occurred_at DESC LIMIT 100`, [zoneId]);
  return result.rows;
}

export async function factionForPlayer(steamId: string) {
  const result = await db().query(`SELECT f.id, f.name, f.color, f.leader_steam_id, m.role, m.joined_at
    FROM tpn_faction_members m JOIN tpn_factions f ON f.id = m.faction_id WHERE m.steam_id = $1`, [steamId]);
  const row = result.rows[0];
  return row ? { id: row.id, name: row.name, color: row.color, leaderSteamId: row.leader_steam_id, role: row.role, joinedAt: row.joined_at } : null;
}

export async function createFaction(steamId: string, name: string, color = "#8b5cf6") {
  return transaction(async (client) => {
    await ensurePlayer(client, steamId);
    const existing = await client.query("SELECT 1 FROM tpn_faction_members WHERE steam_id = $1", [steamId]);
    if (existing.rowCount) throw new Error("already-in-faction");
    const inviteCode = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
    const faction = await client.query(`INSERT INTO tpn_factions (name, invite_code, color, leader_steam_id)
      VALUES ($1, $2, $3, $4) RETURNING id, name, color, leader_steam_id`, [name.trim(), inviteCode, color, steamId]);
    const row = faction.rows[0];
    await client.query("INSERT INTO tpn_faction_members (faction_id, steam_id, role) VALUES ($1, $2, 'leader')", [row.id, steamId]);
    return { id: row.id, name: row.name, color: row.color, leaderSteamId: row.leader_steam_id, inviteCode };
  });
}

export async function rotateInvite(steamId: string, factionId: string) {
  return transaction(async (client) => {
    const membership = await client.query(`SELECT 1 FROM tpn_factions f JOIN tpn_faction_members m ON m.faction_id = f.id
      WHERE f.id = $1 AND m.steam_id = $2 AND m.role = 'leader'`, [factionId, steamId]);
    if (!membership.rowCount) throw new Error("forbidden");
    const inviteCode = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
    await client.query("UPDATE tpn_factions SET invite_code = $1, updated_at = now() WHERE id = $2", [inviteCode, factionId]);
    return { factionId, inviteCode };
  });
}

export async function recordActivity(steamId: string, input: { zoneId: string; activityType: string; points: number; eventId?: string; metadata?: unknown }) {
  return transaction(async (client) => {
    await ensurePlayer(client, steamId);
    const faction = await client.query("SELECT faction_id FROM tpn_faction_members WHERE steam_id = $1", [steamId]);
    const factionId = faction.rows[0]?.faction_id ?? null;
    if (!factionId) throw new Error("player-not-in-faction");
    const eventId = randomUUID();
    const idempotencyKey = input.eventId ?? eventId;
    const inserted = await client.query(`INSERT INTO tpn_territory_influence_events
      (event_id, idempotency_key, steam_id, faction_id, zone_id, activity_type, points, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (idempotency_key) DO NOTHING RETURNING event_id`,
      [eventId, idempotencyKey, steamId, factionId, input.zoneId, input.activityType, input.points, input.metadata ?? {}]);
    if (!inserted.rowCount) return { accepted: false, duplicate: true };
    await client.query(`INSERT INTO tpn_territory_states (zone_id, status, influence)
      VALUES ($1, 'neutral', 0) ON CONFLICT (zone_id) DO NOTHING`, [input.zoneId]);
    const state = await client.query(`UPDATE tpn_territory_states SET influence = influence + $1,
      status = CASE WHEN owner_faction_id IS NULL AND $2::uuid IS NOT NULL THEN 'contested' ELSE status END,
      updated_at = now() WHERE zone_id = $3 RETURNING zone_id, status, influence, owner_faction_id`,
      [input.points, factionId, input.zoneId]);
    if (!state.rowCount) throw new Error("zone-not-found");
    return { accepted: true, duplicate: false, state: state.rows[0] };
  });
}
