import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestCard } from "@/features/quests/components/QuestCard";
import type { Quest, QuestPeriod } from "@/features/quests/types";

const periods: QuestPeriod[] = ["daily", "weekly", "monthly"];
const periodLabels: Record<QuestPeriod, string> = { daily: "Hằng ngày", weekly: "Hằng tuần", monthly: "Hằng tháng" };

export function QuestTabs({ quests }: { quests: Quest[] }) {
  return (
    <Tabs defaultValue="daily" className="min-h-0 flex-1">
      <TabsList>
        {periods.map((period) => (
          <TabsTrigger key={period} value={period}>
            {periodLabels[period]}<span className="ml-1.5 text-[9px] text-ash">{quests.filter((quest) => quest.period === period).length}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {periods.map((period) => {
        const periodQuests = quests.filter((quest) => quest.period === period);
        return (
          <TabsContent key={period} value={period} className="max-h-[min(65vh,660px)] overflow-y-auto p-3 hud-scrollbar">
            <div className="space-y-2.5">
              {periodQuests.length ? periodQuests.map((quest) => <QuestCard key={quest.id} quest={quest} />) : (
                <p className="px-4 py-12 text-center text-sm text-ash">Không có nhiệm vụ {periodLabels[period].toLowerCase()} đang hoạt động.</p>
              )}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
