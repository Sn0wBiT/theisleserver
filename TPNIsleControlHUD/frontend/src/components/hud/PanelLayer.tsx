import { QuestPanel } from "@/features/quests/components/QuestPanel";
import { ExpandedMinimap } from "@/features/minimap/ExpandedMinimap";
import { useOverlayStore } from "@/stores/overlay.store";

export function PanelLayer() {
  const { interactive, panel } = useOverlayStore();
  if (!interactive) return null;
  if (panel === "minimap") return <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 p-4 sm:p-6"><ExpandedMinimap /></div>;
  if (panel === "quests") return <div className="pointer-events-none absolute inset-0 flex items-start justify-end p-4 sm:p-6"><QuestPanel /></div>;
  return null;
}
