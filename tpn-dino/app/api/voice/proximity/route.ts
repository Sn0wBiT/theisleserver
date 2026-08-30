import { resolveApiIdentity } from "@/lib/hud-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await resolveApiIdentity(request);
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const bridgeToken = process.env.QUEST_API_TOKEN;
  if (!bridgeToken) return Response.json({ ok: false, error: "voice-unavailable" }, { status: 503 });
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  try {
    const upstream = await fetch(`${process.env.QUEST_API_URL ?? "http://127.0.0.1:31990"}/voice/${encodeURIComponent(session.steamId)}/stream`, {
      headers: { Authorization: `Bearer ${bridgeToken}`, Accept: "text/event-stream" }, cache: "no-store", signal: controller.signal
    });
    if (!upstream.ok || !upstream.body) throw new Error("upstream");
    return new Response(upstream.body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-store, must-revalidate", "X-Accel-Buffering": "no" } });
  } catch {
    controller.abort();
    return Response.json({ ok: false, error: "voice-unavailable" }, { status: 503 });
  }
}
