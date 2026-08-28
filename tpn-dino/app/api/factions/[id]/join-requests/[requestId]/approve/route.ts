import { factionErrorResponse, isUuid } from "@/lib/faction-api";
import { resolveApiIdentity } from "@/lib/hud-auth";
import { approveFactionJoinRequest } from "@/lib/territories";

export async function POST(request: Request, context: RouteContext<"/api/factions/[id]/join-requests/[requestId]/approve">) {
  const session = await resolveApiIdentity(request);
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id, requestId } = await context.params;
  if (!isUuid(id)) return factionErrorResponse(new Error("invalid-faction-id"));
  if (!isUuid(requestId)) return factionErrorResponse(new Error("invalid-request-id"));
  try {
    return Response.json({ joinRequest: await approveFactionJoinRequest(session.steamId, id, requestId) });
  } catch (error) {
    return factionErrorResponse(error);
  }
}
