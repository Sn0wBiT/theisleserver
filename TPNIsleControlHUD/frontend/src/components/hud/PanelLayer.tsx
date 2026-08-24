import { QuestPanel } from "@/features/quests/components/QuestPanel";
import { useOverlayStore } from "@/stores/overlay.store";

export function PanelLayer() {
  const { interactive, panel } = useOverlayStore();
  if (!interactive || panel !== "quests") return null;
  return <div className="absolute inset-0 flex items-start justify-end p-4 sm:p-6"><QuestPanel /></div>;
}

