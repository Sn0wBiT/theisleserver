import { resolveApiIdentity } from "@/lib/hud-auth";
import { listTerritories } from "@/lib/territories";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await resolveApiIdentity(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try { return Response.json({ territories: await listTerritories() }); }
  catch { return Response.json({ ok: false, error: "territory-service-unavailable" }, { status: 503 }); }
}
