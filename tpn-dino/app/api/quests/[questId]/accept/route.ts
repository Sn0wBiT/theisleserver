import { getSession } from "@/lib/auth";
import { acceptQuest } from "@/lib/quests";

export async function POST(_request: Request, context: RouteContext<"/api/quests/[questId]/accept">) {
  const session = await getSession();
  if (!session) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { questId } = await context.params;
  try {
    const result = await acceptQuest(session.steamId, questId);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "quest-service-unavailable" },
      { status: 502 },
    );
  }
}
