import { Check, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestProgress } from "@/features/quests/components/QuestProgress";
import { QuestReward } from "@/features/quests/components/QuestReward";
import { useClaimQuest } from "@/features/quests/hooks/useClaimQuest";
import type { Quest } from "@/features/quests/types";

export function QuestCard({ quest }: { quest: Quest }) {
  const claim = useClaimQuest();
  const canClaim = quest.completed && !quest.claimed;
  const status = quest.claimed ? "Đã nhận" : quest.completed ? "Hoàn thành" : "Đang thực hiện";
  const typeLabels: Record<string, string> = {
    play_seconds: "Thời gian sinh tồn",
    reach_growth: "Tăng trưởng",
    player_kills: "Hạ người chơi",
    ai_dinosaur_kills: "Hạ khủng long AI",
  };

  return (
    <article className="quest-card group relative border border-stone/60 px-3 py-2.5 transition-colors duration-100 ease-linear hover:border-[#9bd7c4]">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.2em] text-lichen">{typeLabels[quest.type] ?? "Nhiệm vụ"}</span>
          <h3 className="truncate font-display text-base font-medium uppercase leading-tight tracking-[0.06em] text-bone">{quest.name}</h3>
        </div>
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest ${quest.completed ? "text-moss" : "text-ash"}`}>
          {quest.claimed && <Check className="mr-1 inline size-3" />}{status}
        </span>
      </div>
      <QuestProgress quest={quest} />
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone/35 pt-3">
        <QuestReward tokens={quest.rewardTokens} />
        <Button
          className="h-8 min-w-24"
          variant={canClaim ? "default" : "ghost"}
          disabled={!canClaim || claim.isPending}
          onClick={() => claim.mutate(quest.id)}
        >
          {!quest.completed && <LockKeyhole className="size-3" />}
          {claim.isPending && claim.variables === quest.id ? "Đang nhận…" : quest.claimed ? "Đã nhận" : "Nhận thưởng"}
        </Button>
      </div>
    </article>
  );
}
