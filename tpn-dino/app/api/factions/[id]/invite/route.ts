import { resolveApiIdentity } from "@/lib/hud-auth";
import { rotateInvite } from "@/lib/territories";

export async function POST(request: Request, context: RouteContext<"/api/factions/[id]/invite">) {
  const session = await resolveApiIdentity(request);
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try { return Response.json(await rotateInvite(session.steamId, id)); }
  catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "faction-service-unavailable" }, { status: 403 }); }
}
