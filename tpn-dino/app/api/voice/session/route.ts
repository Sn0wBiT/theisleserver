import { AccessToken, TrackSource } from "livekit-server-sdk";
import { getPlayer, resolveApiIdentity } from "@/lib/hud-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await resolveApiIdentity(request);
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const bridgeUrl = process.env.QUEST_API_URL ?? "http://127.0.0.1:31990";
  const bridgeToken = process.env.QUEST_API_TOKEN;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_WS_URL;
  if (!bridgeToken || !apiKey || !apiSecret || !url) return Response.json({ ok: false, error: "voice-unavailable" }, { status: 503 });
  const eligibility = await fetch(`${bridgeUrl}/voice/${encodeURIComponent(session.steamId)}/eligibility`, {
    headers: { Authorization: `Bearer ${bridgeToken}` }, cache: "no-store", signal: AbortSignal.timeout(2500)
  }).catch(() => null);
  if (!eligibility?.ok) return Response.json({ ok: false, error: eligibility?.status === 409 ? "stale-presence" : "voice-unavailable" }, { status: eligibility?.status === 409 ? 409 : 503 });
  const state = await eligibility.json() as { gameServerId: string };
  const player = await getPlayer(session.steamId);
  const room = `voice-${state.gameServerId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  const ttlSeconds = Math.min(300, Math.max(30, Number(process.env.LIVEKIT_TOKEN_TTL_SECONDS ?? 120)));
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const token = new AccessToken(apiKey, apiSecret, { identity: session.steamId, name: player.displayName, ttl: ttlSeconds });
  token.addGrant({ room, roomJoin: true, roomList: false, roomRecord: false, roomAdmin: false,
    canPublish: true, canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false,
    canPublishSources: [TrackSource.MICROPHONE] });
  return Response.json({ url, token: await token.toJwt(), room, gameServerId: state.gameServerId,
    participant: player, expiresAt });
}
