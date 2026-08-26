import { resolveApiIdentity } from "@/lib/hud-auth";
import { territoryHistory } from "@/lib/territories";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: RouteContext<"/api/territories/[zoneId]/history">) {
  if (!await resolveApiIdentity(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { zoneId } = await context.params;
  try { return Response.json({ zoneId, events: await territoryHistory(zoneId) }); }
  catch { return Response.json({ ok: false, error: "territory-service-unavailable" }, { status: 503 }); }
}
