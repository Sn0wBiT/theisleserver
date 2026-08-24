import type { QuestApi } from "@/features/quests/api/quests.api";
import type { QuestResponse } from "@/features/quests/types";

let state: QuestResponse = {
  tokenBalance: 1_275,
  quests: [
    {
      id: "daily_play_30",
      name: "Sinh tồn trong 30 phút",
      period: "daily",
      type: "play_seconds",
      target: 1_800,
      progress: 1_350,
      rewardTokens: 100,
      completed: false,
      claimed: false,
      accepted: true,
      window: "2026-08-24",
    },
    {
      id: "daily_growth_75",
      name: "Đạt mức tăng trưởng 75%",
      period: "daily",
      type: "reach_growth",
      target: 0.75,
      progress: 0.75,
      rewardTokens: 75,
      completed: true,
      claimed: false,
      accepted: true,
      window: "2026-08-24",
    },
    {
      id: "daily_ai_kill_3",
      name: "Hạ 3 khủng long AI",
      period: "daily",
      type: "ai_dinosaur_kills",
      target: 3,
      progress: 3,
      rewardTokens: 90,
      completed: true,
      claimed: true,
      accepted: true,
      window: "2026-08-24",
    },
    {
      id: "weekly_kill_3",
      name: "Hạ 3 người chơi đối địch",
      period: "weekly",
      type: "player_kills",
      target: 3,
      progress: 2,
      rewardTokens: 250,
      completed: false,
      claimed: false,
      accepted: true,
      window: "2026-W35",
    },
    {
      id: "weekly_play_3h",
      name: "Sinh tồn trong 3 giờ",
      period: "weekly",
      type: "play_seconds",
      target: 10_800,
      progress: 10_800,
      rewardTokens: 225,
      completed: true,
      claimed: false,
      accepted: true,
      window: "2026-W35",
    },
    {
      id: "weekly_hunt_tyrannosaurus",
      name: "Săn Tyrannosaurus",
      period: "weekly",
      type: "ai_dinosaur_kills",
      target: 1,
      progress: 0,
      rewardTokens: 150,
      completed: false,
      claimed: false,
      accepted: true,
      window: "2026-W35",
    },
    {
      id: "monthly_play_10h",
      name: "Sinh tồn trong 10 giờ",
      period: "monthly",
      type: "play_seconds",
      target: 36_000,
      progress: 27_420,
      rewardTokens: 500,
      completed: false,
      claimed: false,
      accepted: true,
      window: "2026-08",
    },
    {
      id: "monthly_kill_25",
      name: "Hạ 25 người chơi đối địch",
      period: "monthly",
      type: "player_kills",
      target: 25,
      progress: 25,
      rewardTokens: 1_500,
      completed: true,
      claimed: false,
      accepted: true,
      window: "2026-08",
    },
    {
      id: "monthly_ai_kill_60",
      name: "Hạ 60 khủng long AI",
      period: "monthly",
      type: "ai_dinosaur_kills",
      target: 60,
      progress: 60,
      rewardTokens: 1_800,
      completed: true,
      claimed: true,
      accepted: true,
      window: "2026-08",
    },
  ],
};

function wait(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, 250);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Yêu cầu đã bị hủy", "AbortError"));
    }, { once: true });
  });
}

export const mockQuestApi: QuestApi = {
  async getQuests(signal) {
    await wait(signal);
    return structuredClone(state);
  },
  async claimQuest(id) {
    await wait();
    const quest = state.quests.find((item) => item.id === id);
    if (!quest) throw new Error("Không tìm thấy nhiệm vụ");
    if (!quest.completed) throw new Error("Nhiệm vụ này chưa hoàn thành");
    if (quest.claimed) throw new Error("Phần thưởng này đã được nhận");

    quest.claimed = true;
    state = { ...state, tokenBalance: state.tokenBalance + quest.rewardTokens };
    return { ok: true, rewardTokens: quest.rewardTokens, tokenBalance: state.tokenBalance };
  },
};
