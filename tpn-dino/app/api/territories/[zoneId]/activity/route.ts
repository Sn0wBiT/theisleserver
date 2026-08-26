import { resolveApiIdentity } from "@/lib/hud-auth";
import { recordActivity } from "@/lib/territories";

export async function POST(request: Request, context: RouteContext<"/api/territories/[zoneId]/activity">) {
  const session = await resolveApiIdentity(request);
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { zoneId } = await context.params;
  const input = await request.json().catch(() => ({}));
  const points = Number(input.points);
  if (!zoneId || typeof input.activityType !== "string" || input.activityType.length < 1 || input.activityType.length > 64 ||
      typeof input.eventId !== "string" || input.eventId.length < 1 || input.eventId.length > 200 ||
      !Number.isSafeInteger(points) || points <= 0 || points > 10000)
    return Response.json({ ok: false, error: "invalid-activity" }, { status: 400 });
  try { return Response.json(await recordActivity(session.steamId, { ...input, zoneId, points })); }
  catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "territory-service-unavailable" }, { status: 400 }); }
}
