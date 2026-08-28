import { factionErrorResponse } from "@/lib/faction-api";
import { resolveApiIdentity } from "@/lib/hud-auth";
import { submitFactionJoinRequest } from "@/lib/territories";

export async function POST(request: Request) {
  const session = await resolveApiIdentity(request);
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => ({}));
  if (typeof input.inviteCode !== "string") return factionErrorResponse(new Error("invalid-invite-code"));
  try {
    return Response.json({ joinRequest: await submitFactionJoinRequest(session.steamId, input.inviteCode) }, { status: 201 });
  } catch (error) {
    return factionErrorResponse(error);
  }
}
