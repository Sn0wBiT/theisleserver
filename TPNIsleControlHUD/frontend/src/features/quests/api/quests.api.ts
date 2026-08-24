import { request } from "@/services/api";
import { mockQuestApi } from "@/features/quests/api/quests.mock";
import { claimQuestResultSchema, questResponseSchema, type ClaimQuestResult, type QuestResponse } from "@/features/quests/types";

export interface QuestApi {
  getQuests(signal?: AbortSignal): Promise<QuestResponse>;
  claimQuest(id: string): Promise<ClaimQuestResult>;
}

const nextQuestApi: QuestApi = {
  async getQuests(signal) {
    return questResponseSchema.parse(await request<unknown>("/api/quests", { signal }));
  },
  async claimQuest(id) {
    return claimQuestResultSchema.parse(await request<unknown>(`/api/quests/${encodeURIComponent(id)}/claim`, { method: "POST" }));
  },
};

export const restQuestApi: QuestApi = import.meta.env.DEV ? mockQuestApi : nextQuestApi;
