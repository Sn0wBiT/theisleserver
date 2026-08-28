import { factionErrorResponse, isUuid } from "@/lib/faction-api";
import { resolveApiIdentity } from "@/lib/hud-auth";
import { cancelFactionJoinRequest } from "@/lib/territories";

export async function DELETE(request: Request, context: RouteContext<"/api/factions/join-requests/[requestId]">) {
  const session = await resolveApiIdentity(request);
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { requestId } = await context.params;
  if (!isUuid(requestId)) return factionErrorResponse(new Error("invalid-request-id"));
  try {
    return Response.json(await cancelFactionJoinRequest(session.steamId, requestId));
  } catch (error) {
    return factionErrorResponse(error);
  }
}
