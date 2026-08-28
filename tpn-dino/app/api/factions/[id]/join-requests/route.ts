import { factionErrorResponse, isUuid } from "@/lib/faction-api";
import { resolveApiIdentity } from "@/lib/hud-auth";
import { listPendingFactionJoinRequests } from "@/lib/territories";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/factions/[id]/join-requests">) {
  const session = await resolveApiIdentity(request);
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!isUuid(id)) return factionErrorResponse(new Error("invalid-faction-id"));
  try {
    return Response.json({ joinRequests: await listPendingFactionJoinRequests(session.steamId, id) });
  } catch (error) {
    return factionErrorResponse(error);
  }
}
