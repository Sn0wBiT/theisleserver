import { rotateRefreshToken } from "@/lib/hud-auth";

export function OPTIONS() { return new Response(null, { status: 204 }); }
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { refreshToken?: string } | null;
  const result = body?.refreshToken ? await rotateRefreshToken(body.refreshToken) : null;
  return result ? Response.json(result) : Response.json({ error: "invalid-refresh-token" }, { status: 401 });
}
