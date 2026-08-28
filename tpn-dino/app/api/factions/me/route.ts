import { resolveApiIdentity } from "@/lib/hud-auth";
import { factionForPlayer, joinRequestForPlayer } from "@/lib/territories";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const session = await resolveApiIdentity(request);
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const [faction, joinRequest] = await Promise.all([
      factionForPlayer(session.steamId),
      joinRequestForPlayer(session.steamId),
    ]);
    return Response.json({ faction, joinRequest });
  }
  catch { return Response.json({ ok: false, error: "faction-service-unavailable" }, { status: 503 }); }
}
