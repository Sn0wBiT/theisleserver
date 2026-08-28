import { consumeRateLimit, startAttempt } from "@/lib/hud-auth";
import { appOrigin } from "@/lib/app-origin";

export function OPTIONS() { return new Response(null, { status: 204 }); }
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!await consumeRateLimit(`start:${ip}`, Number(process.env.HUD_START_RATE_LIMIT ?? 10), 60)) {
    return Response.json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  return Response.json(await startAttempt(appOrigin(request)), { status: 201 });
}
