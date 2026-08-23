import "server-only";

export type Quest = {
  id: string; name: string; period: string; type: string; target: number;
  rewardTokens: number; window: string; accepted: boolean; progress: number;
  completed: boolean; claimed: boolean;
};
export type QuestState = { steam: string; tokenBalance: number; quests: Quest[] };

export async function getQuests(steamId: string): Promise<QuestState> {
  const baseUrl = process.env.QUEST_API_URL ?? "http://127.0.0.1:31990";
  const token = process.env.QUEST_API_TOKEN;
  if (!token) throw new Error("QUEST_API_TOKEN is not configured");
  const response = await fetch(`${baseUrl}/quests/${encodeURIComponent(steamId)}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Quest service returned ${response.status}`);
  return (await response.json()) as QuestState;
}
