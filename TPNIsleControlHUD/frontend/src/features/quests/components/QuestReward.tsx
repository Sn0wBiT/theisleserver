import { Hexagon } from "lucide-react";

export function QuestReward({ tokens }: { tokens: number }) {
  return (
    <div className="flex items-center gap-1.5 text-sm font-bold text-amber">
      <Hexagon aria-hidden="true" className="size-3.5 fill-amber/20" />
      <span>{tokens.toLocaleString("vi-VN")}</span><span className="text-[10px] font-medium uppercase tracking-widest text-ash">token</span>
    </div>
  );
}
