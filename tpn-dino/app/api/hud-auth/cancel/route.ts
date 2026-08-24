import { cancelAttempt } from "@/lib/hud-auth";

export function OPTIONS() { return new Response(null, { status: 204 }); }
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { deviceCode?: string } | null;
  if (!body?.deviceCode || !await cancelAttempt(body.deviceCode)) return Response.json({ error: "invalid-device-code" }, { status: 400 });
  return Response.json({ ok: true });
}
