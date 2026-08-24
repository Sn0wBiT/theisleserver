import { revokeRefreshToken } from "@/lib/hud-auth";

export function OPTIONS() { return new Response(null, { status: 204 }); }
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { refreshToken?: string } | null;
  if (body?.refreshToken) await revokeRefreshToken(body.refreshToken);
  return new Response(null, { status: 204 });
}
