import "server-only";

export type Quest = {
  id: string; name: string; period: string; type: string; target: number;
  rewardTokens: number; window: string; accepted: boolean; progress: number;
  completed: boolean; claimed: boolean; canAccept: boolean;
  takeRequirement?: { minimumGrowth?: number };
};
export type CurrentDinosaur = {
  species: string | null; growth: number | null; snapshotAt: number | null;
};
export type QuestState = {
  steam: string; tokenBalance: number; currentDinosaur: CurrentDinosaur | null; quests: Quest[];
};
export type AcceptQuestResult = {
  ok: boolean; error?: string; requiredGrowth?: number; currentGrowth?: number | null;
};

function apiConfig() {
  const baseUrl = process.env.QUEST_API_URL ?? "http://127.0.0.1:31990";
  const token = process.env.QUEST_API_TOKEN;
  if (!token) throw new Error("QUEST_API_TOKEN is not configured");
  return { baseUrl, token };
}

export async function getQuests(steamId: string): Promise<QuestState> {
  const { baseUrl, token } = apiConfig();
  const response = await fetch(`${baseUrl}/quests/${encodeURIComponent(steamId)}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Quest service returned ${response.status}`);
  return (await response.json()) as QuestState;
}

export async function acceptQuest(steamId: string, questId: string): Promise<AcceptQuestResult> {
  const { baseUrl, token } = apiConfig();
  const response = await fetch(
    `${baseUrl}/quests/${encodeURIComponent(steamId)}/accept/${encodeURIComponent(questId)}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) },
  );
  const result = (await response.json()) as AcceptQuestResult;
  if (!response.ok && !result.error) throw new Error(`Quest service returned ${response.status}`);
  return result;
}
