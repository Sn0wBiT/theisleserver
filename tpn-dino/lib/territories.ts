import "server-only";

import { randomUUID } from "node:crypto";
import { db, transaction } from "./db";

export type Territory = {
  zoneId: string; name: string; polygon: unknown; terrainType: string | null;
  status: string; influence: number; ownerFactionId: string | null;
};

export type FactionJoinRequest = {
  id: string;
  status: "pending" | "rejected";
  createdAt: string;
  updatedAt: string;
  faction: { id: string; name: string; color: string };
};

export type PendingFactionJoinRequest = {
  id: string;
  steamId: string;
  displayName: string;
  createdAt: string;
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
  const result = await db().query(`SELECT f.id, f.name, f.color, f.leader_steam_id, m.role, m.joined_at,
      CASE WHEN m.role = 'leader' THEN f.invite_code END AS invite_code
    FROM tpn_faction_members m JOIN tpn_factions f ON f.id = m.faction_id WHERE m.steam_id = $1`, [steamId]);
  const row = result.rows[0];
  return row ? { id: row.id, name: row.name, color: row.color, leaderSteamId: row.leader_steam_id,
    role: row.role, joinedAt: row.joined_at, ...(row.invite_code ? { inviteCode: row.invite_code } : {}) } : null;
}

function joinRequestFromRow(row: Record<string, unknown>): FactionJoinRequest {
  return {
    id: String(row.id),
    status: row.status as FactionJoinRequest["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    faction: { id: String(row.faction_id), name: String(row.faction_name), color: String(row.faction_color) },
  };
}

export async function joinRequestForPlayer(steamId: string): Promise<FactionJoinRequest | null> {
  const result = await db().query(`SELECT r.id, r.status, r.created_at, r.updated_at,
      f.id AS faction_id, f.name AS faction_name, f.color AS faction_color
    FROM tpn_faction_join_requests r JOIN tpn_factions f ON f.id = r.faction_id
    WHERE r.steam_id = $1 AND r.status IN ('pending', 'rejected')
    ORDER BY r.created_at DESC LIMIT 1`, [steamId]);
  return result.rows[0] ? joinRequestFromRow(result.rows[0]) : null;
}

export async function submitFactionJoinRequest(steamId: string, rawInviteCode: string): Promise<FactionJoinRequest> {
  const inviteCode = rawInviteCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{12}$/.test(inviteCode)) throw new Error("invalid-invite-code");
  return transaction(async (client) => {
    await ensurePlayer(client, steamId);
    await client.query("SELECT steam_id FROM tpn_players WHERE steam_id = $1 FOR UPDATE", [steamId]);
    const member = await client.query("SELECT 1 FROM tpn_faction_members WHERE steam_id = $1", [steamId]);
    if (member.rowCount) throw new Error("already-in-faction");
    const active = await client.query("SELECT 1 FROM tpn_faction_join_requests WHERE steam_id = $1 AND status IN ('pending', 'rejected')", [steamId]);
    if (active.rowCount) throw new Error("active-request-exists");
    const faction = await client.query("SELECT id, name, color FROM tpn_factions WHERE invite_code = $1", [inviteCode]);
    if (!faction.rowCount) throw new Error("invalid-invite-code");
    try {
      const inserted = await client.query(`INSERT INTO tpn_faction_join_requests (faction_id, steam_id)
        VALUES ($1, $2) RETURNING id, status, created_at, updated_at`, [faction.rows[0].id, steamId]);
      return joinRequestFromRow({ ...inserted.rows[0], faction_id: faction.rows[0].id,
        faction_name: faction.rows[0].name, faction_color: faction.rows[0].color });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new Error("active-request-exists");
      }
      throw error;
    }
  });
}

export async function listPendingFactionJoinRequests(steamId: string, factionId: string): Promise<PendingFactionJoinRequest[]> {
  const result = await db().query(`SELECT r.id, r.steam_id, r.created_at,
      COALESCE(h.display_name, p.display_name, r.steam_id) AS display_name
    FROM tpn_faction_members leader
    JOIN tpn_faction_join_requests r ON r.faction_id = leader.faction_id AND r.status = 'pending'
    JOIN tpn_players p ON p.steam_id = r.steam_id
    LEFT JOIN tpn_hud_steam_profiles h ON h.steam_id = r.steam_id
    WHERE leader.faction_id = $1 AND leader.steam_id = $2 AND leader.role = 'leader'
    ORDER BY r.created_at ASC`, [factionId, steamId]);
  const leader = await db().query("SELECT 1 FROM tpn_faction_members WHERE faction_id = $1 AND steam_id = $2 AND role = 'leader'", [factionId, steamId]);
  if (!leader.rowCount) throw new Error("forbidden");
  return result.rows.map((row) => ({ id: row.id, steamId: row.steam_id,
    displayName: row.display_name, createdAt: row.created_at }));
}

async function decideFactionJoinRequest(steamId: string, factionId: string, requestId: string, decision: "approved" | "rejected") {
  return transaction(async (client) => {
    const request = await client.query("SELECT id, faction_id, steam_id, status FROM tpn_faction_join_requests WHERE id = $1 FOR UPDATE", [requestId]);
    if (!request.rowCount || request.rows[0].faction_id !== factionId) throw new Error("request-not-found");
    const leader = await client.query("SELECT 1 FROM tpn_faction_members WHERE faction_id = $1 AND steam_id = $2 AND role = 'leader'", [factionId, steamId]);
    if (!leader.rowCount) throw new Error("forbidden");
    if (request.rows[0].status !== "pending") throw new Error("request-not-pending");
    if (decision === "approved") {
      await client.query("SELECT steam_id FROM tpn_players WHERE steam_id = $1 FOR UPDATE", [request.rows[0].steam_id]);
      const member = await client.query("SELECT 1 FROM tpn_faction_members WHERE steam_id = $1", [request.rows[0].steam_id]);
      if (member.rowCount) throw new Error("already-in-faction");
      try {
        await client.query("INSERT INTO tpn_faction_members (faction_id, steam_id, role) VALUES ($1, $2, 'member')", [factionId, request.rows[0].steam_id]);
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
          throw new Error("already-in-faction");
        }
        throw error;
      }
    }
    const updated = await client.query(`UPDATE tpn_faction_join_requests
      SET status = $1, updated_at = now(), resolved_at = now(), resolved_by_steam_id = $2
      WHERE id = $3 RETURNING id, status`, [decision, steamId, requestId]);
    return { id: updated.rows[0].id, status: updated.rows[0].status };
  });
}

export function approveFactionJoinRequest(steamId: string, factionId: string, requestId: string) {
  return decideFactionJoinRequest(steamId, factionId, requestId, "approved");
}

export function rejectFactionJoinRequest(steamId: string, factionId: string, requestId: string) {
  return decideFactionJoinRequest(steamId, factionId, requestId, "rejected");
}

export async function cancelFactionJoinRequest(steamId: string, requestId: string) {
  return transaction(async (client) => {
    const request = await client.query("SELECT id, steam_id, status FROM tpn_faction_join_requests WHERE id = $1 FOR UPDATE", [requestId]);
    if (!request.rowCount) throw new Error("request-not-found");
    if (request.rows[0].steam_id !== steamId) throw new Error("forbidden");
    if (request.rows[0].status !== "pending" && request.rows[0].status !== "rejected") throw new Error("request-not-pending");
    await client.query(`UPDATE tpn_faction_join_requests SET status = 'cancelled', updated_at = now(),
      resolved_at = now(), resolved_by_steam_id = $1 WHERE id = $2`, [steamId, requestId]);
    return { id: requestId, status: "cancelled" as const };
  });
}

export async function createFaction(steamId: string, name: string, color = "#8b5cf6") {
  return transaction(async (client) => {
    await ensurePlayer(client, steamId);
    await client.query("SELECT steam_id FROM tpn_players WHERE steam_id = $1 FOR UPDATE", [steamId]);
    const existing = await client.query("SELECT 1 FROM tpn_faction_members WHERE steam_id = $1", [steamId]);
    if (existing.rowCount) throw new Error("already-in-faction");
    const active = await client.query("SELECT 1 FROM tpn_faction_join_requests WHERE steam_id = $1 AND status IN ('pending', 'rejected')", [steamId]);
    if (active.rowCount) throw new Error("active-request-exists");
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
