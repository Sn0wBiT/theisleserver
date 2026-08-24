import { Progress } from "@/components/ui/progress";
import type { Quest } from "@/features/quests/types";

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function progressLabel(quest: Quest) {
  if (quest.type === "play_seconds") return `${duration(quest.progress)} / ${duration(quest.target)}`;
  if (quest.type === "reach_growth") return `${Math.round(quest.progress * 100)}% / ${Math.round(quest.target * 100)}%`;
  return `${quest.progress.toLocaleString("vi-VN")} / ${quest.target.toLocaleString("vi-VN")}`;
}

export function QuestProgress({ quest }: { quest: Quest }) {
  const percent = quest.target > 0 ? Math.min(100, (quest.progress / quest.target) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-ash">
        <span>Tiến độ</span><span className="font-mono text-bone">{progressLabel(quest)}</span>
      </div>
      <Progress value={percent} />
    </div>
  );
}
