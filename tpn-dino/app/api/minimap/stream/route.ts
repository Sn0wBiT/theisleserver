import { resolveApiIdentity } from "@/lib/hud-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function GET(request: Request) {
  const session = await resolveApiIdentity(request);
  if (!session) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.QUEST_API_URL ?? "http://127.0.0.1:31990";
  const token = process.env.QUEST_API_TOKEN;
  if (!token) {
    return Response.json({ ok: false, error: "position-service-unavailable" }, { status: 502 });
  }

  const upstreamAbort = new AbortController();
  const abortUpstream = () => upstreamAbort.abort();
  request.signal.addEventListener("abort", abortUpstream, { once: true });

  try {
    const upstream = await fetch(
      `${baseUrl}/players/${encodeURIComponent(session.steamId)}/position/stream`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        cache: "no-store",
        signal: upstreamAbort.signal,
      },
    );
    if (!upstream.ok || !upstream.body) {
      upstreamAbort.abort();
      return Response.json({ ok: false, error: "position-service-unavailable" }, { status: 502 });
    }

    const reader = upstream.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await reader.read();
          if (chunk.done) {
            request.signal.removeEventListener("abort", abortUpstream);
            controller.close();
          }
          else controller.enqueue(chunk.value);
        } catch (error) {
          request.signal.removeEventListener("abort", abortUpstream);
          if (!upstreamAbort.signal.aborted) controller.error(error);
          else controller.close();
        }
      },
      async cancel() {
        upstreamAbort.abort();
        request.signal.removeEventListener("abort", abortUpstream);
        await reader.cancel().catch(() => undefined);
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    upstreamAbort.abort();
    request.signal.removeEventListener("abort", abortUpstream);
    return Response.json({ ok: false, error: "position-service-unavailable" }, { status: 502 });
  }
}
