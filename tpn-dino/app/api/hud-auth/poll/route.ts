import { consumeRateLimit, pollAttempt } from "@/lib/hud-auth";
import { createHash } from "node:crypto";

export function OPTIONS() { return new Response(null, { status: 204 }); }
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { deviceCode?: string } | null;
  if (!body?.deviceCode) return Response.json({ error: "invalid-device-code" }, { status: 400 });
  const rateKey = createHash("sha256").update(body.deviceCode).digest("hex");
  if (!await consumeRateLimit(`poll:${rateKey}`, Number(process.env.HUD_POLL_RATE_LIMIT ?? 120), 300)) {
    return Response.json({ error: "slow-down" }, { status: 429, headers: { "Retry-After": "5" } });
  }
  const result = await pollAttempt(body.deviceCode);
  if (result.status === "pending") return Response.json({ status: "pending" }, { status: 202 });
  if (result.status === "approved") return Response.json(result);
  const codes: Record<string, number> = { invalid: 400, cancelled: 409, expired: 410, consumed: 409 };
  return Response.json({ error: result.status }, { status: codes[result.status] ?? 400 });
}
