import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "tpn_steam_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
type Session = { steamId: string; expiresAt: number };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encodeSession(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

function decodeSession(value: string): Session | null {
  const [payload, suppliedSignature] = value.split(".");
  if (!payload || !suppliedSignature) return null;
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(signature(payload));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (!/^\d{17}$/.test(session.steamId) || session.expiresAt <= Date.now()) return null;
    return session;
  } catch { return null; }
}

export async function getSession() {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value ? decodeSession(value) : null;
}

export async function createSession(steamId: string) {
  if (!/^\d{17}$/.test(steamId)) throw new Error("Invalid Steam ID");
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  (await cookies()).set(COOKIE_NAME, encodeSession({ steamId, expiresAt }), {
    httpOnly: true, sameSite: "lax", secure: process.env.SESSION_COOKIE_SECURE === "true",
    path: "/", maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession() { (await cookies()).delete(COOKIE_NAME); }
