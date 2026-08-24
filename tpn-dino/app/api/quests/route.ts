import { getSession } from "@/lib/auth";
import { getQuests } from "@/lib/quests";

export function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    return Response.json(await getQuests(session.steamId));
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "quest-service-unavailable" },
      { status: 502 },
    );
  }
}
