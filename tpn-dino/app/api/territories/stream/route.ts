import { resolveApiIdentity } from "@/lib/hud-auth";
import { listTerritories } from "@/lib/territories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!await resolveApiIdentity(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const publish = async () => {
        try {
          const territories = await listTerritories();
          controller.enqueue(encoder.encode(`event: territories\ndata: ${JSON.stringify({ territories, stale: false })}\n\n`));
        } catch {
          controller.enqueue(encoder.encode("event: status\ndata: {\"stale\":true}\n\n"));
        }
      };
      await publish();
      timer = setInterval(publish, 5000);
    },
    cancel() { if (timer) clearInterval(timer); },
  });
  request.signal.addEventListener("abort", () => { if (timer) clearInterval(timer); }, { once: true });
  return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no" } });
}
