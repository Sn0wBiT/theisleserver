import { Check, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/old_button";
import { QuestProgress } from "@/features/quests/components/QuestProgress";
import { QuestReward } from "@/features/quests/components/QuestReward";
import { useClaimQuest } from "@/features/quests/hooks/useClaimQuest";
import { useAcceptQuest } from "@/features/quests/hooks/useAcceptQuest";
import type { Quest } from "@/features/quests/types";
import { questAction } from "@/features/quests/quest-state";

export function QuestCard({ quest }: { quest: Quest }) {
  const claim = useClaimQuest();
  const accept = useAcceptQuest();
  const action = questAction(quest);
  const accepted = quest.accepted === true;
  const canAccept = action === "accept";
  const canClaim = action === "claim";
  const status = action === "claimed" ? "Đã nhận thưởng" : action === "accept" ? "Có thể nhận" : action === "ineligible" ? "Chưa đủ điều kiện" : action === "claim" ? "Có thể nhận thưởng" : "Đang thực hiện";
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
          variant={canClaim || canAccept ? "default" : "ghost"}
          disabled={(!canClaim && !canAccept) || claim.isPending || accept.isPending}
          onClick={() => canAccept ? accept.mutate(quest.id) : claim.mutate(quest.id)}
        >
          {(!accepted || !quest.completed) && !canAccept && <LockKeyhole className="size-3" />}
          {accept.isPending && accept.variables === quest.id ? "Đang nhận…" : claim.isPending && claim.variables === quest.id ? "Đang nhận thưởng…" : quest.claimed ? "Đã nhận thưởng" : canAccept ? "Nhận nhiệm vụ" : canClaim ? "Nhận thưởng" : accepted ? "Chưa hoàn thành" : "Chưa thể nhận"}
        </Button>
      </div>
    </article>
  );
}
