import { request } from "@/services/api";
import { mockQuestApi } from "@/features/quests/api/quests.mock";
import { acceptQuestResultSchema, claimQuestResultSchema, questResponseSchema, type AcceptQuestResult, type ClaimQuestResult, type QuestResponse } from "@/features/quests/types";

export interface QuestApi {
  getQuests(signal?: AbortSignal): Promise<QuestResponse>;
  acceptQuest(id: string): Promise<AcceptQuestResult>;
  claimQuest(id: string): Promise<ClaimQuestResult>;
}

const nextQuestApi: QuestApi = {
  async getQuests(signal) {
    return questResponseSchema.parse(await request<unknown>("/api/quests", { signal }));
  },
  async claimQuest(id) {
    return claimQuestResultSchema.parse(await request<unknown>(`/api/quests/${encodeURIComponent(id)}/claim`, { method: "POST" }));
  },
  async acceptQuest(id) {
    return acceptQuestResultSchema.parse(await request<unknown>(`/api/quests/${encodeURIComponent(id)}/accept`, { method: "POST" }));
  },
};

export const restQuestApi: QuestApi = import.meta.env.DEV ? mockQuestApi : nextQuestApi;
