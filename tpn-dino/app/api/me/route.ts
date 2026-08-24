import { getPlayer, resolveApiIdentity } from "@/lib/hud-auth";

export function OPTIONS() { return new Response(null, { status: 204 }); }
export async function GET(request: Request) {
  const identity = await resolveApiIdentity(request);
  return identity ? Response.json(await getPlayer(identity.steamId)) : Response.json({ error: "unauthorized" }, { status: 401 });
}
