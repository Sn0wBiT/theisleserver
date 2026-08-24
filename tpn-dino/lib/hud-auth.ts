import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { db, transaction } from "./db";

export type PublicPlayer = { steamId: string; displayName: string; avatarUrl: string | null };
type AccessClaims = { sub: string; exp: number; iat: number; typ: "hud-access" };

const devicePattern = /^[A-Za-z0-9_-]{43}$/;
const browserPattern = /^[A-Za-z0-9_-]{32}$/;
const attemptSeconds = Number(process.env.HUD_LOGIN_TTL_SECONDS ?? 300);
const accessSeconds = Number(process.env.HUD_ACCESS_TOKEN_TTL_SECONDS ?? 900);
const refreshSeconds = Number(process.env.HUD_REFRESH_TOKEN_TTL_SECONDS ?? 2592000);
export const pollInterval = Math.max(3, Number(process.env.HUD_POLL_INTERVAL_SECONDS ?? 3));
export const browserBindingCookie = "tpn_hud_connect";

function secret() {
  const value = process.env.HUD_ACCESS_TOKEN_SECRET;
  if (!value || value.length < 32) throw new Error("HUD_ACCESS_TOKEN_SECRET must contain at least 32 characters");
  return value;
}

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function random(size: number) { return randomBytes(size).toString("base64url"); }
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }
function safeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createBrowserBinding(browserCode: string) {
  if (!browserPattern.test(browserCode)) throw new Error("Invalid browser code");
  const payload = Buffer.from(JSON.stringify({ code: browserCode, exp: Date.now() + attemptSeconds * 1000 })).toString("base64url");
  return `${payload}.${sign(`browser:${payload}`)}`;
}

export function readBrowserBinding(value: string | undefined) {
  if (!value) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra || !safeEqual(signature, sign(`browser:${payload}`))) return null;
  try {
    const binding = JSON.parse(Buffer.from(payload, "base64url").toString()) as { code: string; exp: number };
    return browserPattern.test(binding.code) && binding.exp > Date.now() ? binding.code : null;
  } catch { return null; }
}

export function issueAccessToken(steamId: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ sub: steamId, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + accessSeconds, typ: "hud-access" } satisfies AccessClaims)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyAccessToken(token: string, now = Date.now()): AccessClaims | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !safeEqual(signature, sign(payload))) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as AccessClaims;
    return claims.typ === "hud-access" && /^\d{17}$/.test(claims.sub) && claims.exp > Math.floor(now / 1000) ? claims : null;
  } catch { return null; }
}

export async function resolveApiIdentity(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const claims = verifyAccessToken(authorization.slice(7));
    return claims ? { steamId: claims.sub } : null;
  }
  const { getSession } = await import("@/lib/auth");
  return getSession();
}

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const result = await db().query(
    `INSERT INTO tpn_hud_rate_limits (rate_key, window_started_at, count)
     VALUES ($1, now(), 1)
     ON CONFLICT (rate_key) DO UPDATE SET
       window_started_at = CASE WHEN tpn_hud_rate_limits.window_started_at <= now() - ($2 * interval '1 second') THEN now() ELSE tpn_hud_rate_limits.window_started_at END,
       count = CASE WHEN tpn_hud_rate_limits.window_started_at <= now() - ($2 * interval '1 second') THEN 1 ELSE tpn_hud_rate_limits.count + 1 END
     RETURNING count`, [key, windowSeconds]);
  return Number(result.rows[0].count) <= limit;
}

export async function startAttempt(origin: string) {
  const deviceCode = random(32); const browserCode = random(24);
  await db().query(
    `INSERT INTO tpn_hud_login_attempts (device_code_hash, browser_code_hash, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 second'))`, [hash(deviceCode), hash(browserCode), attemptSeconds]);
  return { deviceCode, browserCode, verificationUrl: `${origin}/hud/connect?code=${encodeURIComponent(browserCode)}`, expiresIn: attemptSeconds, pollInterval };
}

export async function getAttempt(browserCode: string) {
  if (!browserPattern.test(browserCode)) return null;
  const codeHash = hash(browserCode);
  await db().query(
    `UPDATE tpn_hud_login_attempts SET status = 'expired', updated_at = now()
     WHERE browser_code_hash = $1 AND status IN ('pending','approved') AND expires_at <= now()`, [codeHash]);
  const result = await db().query("SELECT status, expires_at, steam_id FROM tpn_hud_login_attempts WHERE browser_code_hash = $1", [codeHash]);
  return result.rows[0] ?? null;
}

export async function approveAttempt(browserCode: string, steamId: string) {
  if (!browserPattern.test(browserCode)) return false;
  const result = await db().query(
    `UPDATE tpn_hud_login_attempts SET status = 'approved', steam_id = $2, approved_at = now(), updated_at = now()
     WHERE browser_code_hash = $1 AND status = 'pending' AND expires_at > now()`, [hash(browserCode), steamId]);
  return result.rowCount === 1;
}

async function createRefreshSession(client: PoolClient, steamId: string, familyId = random(18)) {
  const token = random(32);
  await client.query(
    `INSERT INTO tpn_hud_refresh_sessions (token_hash, family_id, steam_id, expires_at)
     VALUES ($1, $2, $3, now() + ($4 * interval '1 second'))`, [hash(token), familyId, steamId, refreshSeconds]);
  return token;
}

export async function pollAttempt(deviceCode: string) {
  if (!devicePattern.test(deviceCode)) return { status: "invalid" as const };
  return transaction(async (client) => {
    const result = await client.query(
      `SELECT id, status, steam_id, expires_at FROM tpn_hud_login_attempts WHERE device_code_hash = $1 FOR UPDATE`, [hash(deviceCode)]);
    const attempt = result.rows[0];
    if (!attempt) return { status: "invalid" as const };
    if (new Date(attempt.expires_at).getTime() <= Date.now() && ["pending", "approved"].includes(attempt.status)) {
      await client.query("UPDATE tpn_hud_login_attempts SET status = 'expired', updated_at = now() WHERE id = $1", [attempt.id]);
      return { status: "expired" as const };
    }
    if (attempt.status !== "approved") return { status: attempt.status as "pending" | "cancelled" | "expired" | "consumed" };
    await client.query("UPDATE tpn_hud_login_attempts SET status = 'consumed', consumed_at = now(), updated_at = now() WHERE id = $1", [attempt.id]);
    const refreshToken = await createRefreshSession(client, attempt.steam_id);
    return { status: "approved" as const, player: await getPlayer(attempt.steam_id, client), accessToken: issueAccessToken(attempt.steam_id), refreshToken, expiresIn: accessSeconds };
  });
}

export async function cancelAttempt(deviceCode: string) {
  if (!devicePattern.test(deviceCode)) return false;
  const result = await db().query(
    `UPDATE tpn_hud_login_attempts SET status = 'cancelled', updated_at = now()
     WHERE device_code_hash = $1 AND status IN ('pending','cancelled') RETURNING status`, [hash(deviceCode)]);
  return Boolean(result.rowCount);
}

export async function rotateRefreshToken(token: string) {
  if (!devicePattern.test(token)) return null;
  return transaction(async (client) => {
    const result = await client.query("SELECT * FROM tpn_hud_refresh_sessions WHERE token_hash = $1 FOR UPDATE", [hash(token)]);
    const session = result.rows[0];
    if (!session) return null;
    if (session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
      if (session.revoked_at) await client.query("UPDATE tpn_hud_refresh_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = $1", [session.family_id]);
      return null;
    }
    await client.query("UPDATE tpn_hud_refresh_sessions SET revoked_at = now(), last_used_at = now() WHERE id = $1", [session.id]);
    const refreshToken = await createRefreshSession(client, session.steam_id, session.family_id);
    return { player: await getPlayer(session.steam_id, client), accessToken: issueAccessToken(session.steam_id), refreshToken, expiresIn: accessSeconds };
  });
}

export async function revokeRefreshToken(token: string) {
  if (!devicePattern.test(token)) return;
  await db().query("UPDATE tpn_hud_refresh_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE token_hash = $1", [hash(token)]);
}

export async function getPlayer(steamId: string, client: Pick<PoolClient, "query"> = db()): Promise<PublicPlayer> {
  const result = await client.query("SELECT steam_id, display_name, avatar_url FROM tpn_hud_steam_profiles WHERE steam_id = $1", [steamId]);
  const row = result.rows[0];
  return row ? { steamId: row.steam_id, displayName: row.display_name, avatarUrl: row.avatar_url } : { steamId, displayName: steamId, avatarUrl: null };
}

export async function cacheSteamProfile(steamId: string) {
  const key = process.env.STEAM_WEB_API_KEY;
  let player: PublicPlayer = { steamId, displayName: steamId, avatarUrl: null };
  if (key) {
    try {
      const response = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(key)}&steamids=${steamId}`, { cache: "no-store" });
      const profile = (await response.json()).response?.players?.[0];
      if (response.ok && profile) player = { steamId, displayName: profile.personaname || steamId, avatarUrl: profile.avatarfull || null };
    } catch { /* Public profile enrichment is best effort. */ }
  }
  await db().query(
    `INSERT INTO tpn_hud_steam_profiles (steam_id, display_name, avatar_url) VALUES ($1,$2,$3)
     ON CONFLICT (steam_id) DO UPDATE SET display_name = EXCLUDED.display_name, avatar_url = EXCLUDED.avatar_url, updated_at = now()`,
    [player.steamId, player.displayName, player.avatarUrl]);
  return player;
}
