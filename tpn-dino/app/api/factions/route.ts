import { factionErrorResponse } from "@/lib/faction-api";
import { resolveApiIdentity } from "@/lib/hud-auth";
import { createFaction } from "@/lib/territories";

export async function POST(request: Request) {
  const session = await resolveApiIdentity(request);
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => ({}));
  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 64)
    return Response.json({ ok: false, error: "invalid-name" }, { status: 400 });
  try { return Response.json({ faction: await createFaction(session.steamId, input.name, input.color) }, { status: 201 }); }
  catch (error) { return factionErrorResponse(error); }
}
