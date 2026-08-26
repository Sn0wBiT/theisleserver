import { resolveApiIdentity } from "@/lib/hud-auth";
import { factionForPlayer } from "@/lib/territories";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const session = await resolveApiIdentity(request);
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try { return Response.json({ faction: await factionForPlayer(session.steamId) }); }
  catch { return Response.json({ ok: false, error: "faction-service-unavailable" }, { status: 503 }); }
}
