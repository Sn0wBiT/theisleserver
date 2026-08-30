import { QuestPanel } from "@/features/quests/components/QuestPanel";
import { GangPanel } from "@/features/gang/GangPanel";
import { ExpandedMinimap } from "@/features/minimap/ExpandedMinimap";
import { useOverlayStore } from "@/stores/overlay.store";
import { VoicePanel } from "@/features/voice/VoicePanel";

export function PanelLayer() {
  const { interactive, panel, gangOpen, expandedMinimapOpen } = useOverlayStore();
  if (!interactive) return null;

  return (
    <>
      {expandedMinimapOpen && (
        <div className="pointer-events-none absolute z-100 inset-0 flex items-center justify-center bg-black/25 p-4 sm:p-6">
          <ExpandedMinimap />
        </div>
      )}
      {panel === "quests" && <div className="pointer-events-none absolute z-[110] inset-0 flex items-start justify-end p-4 sm:p-6"><QuestPanel /></div>}
      {gangOpen && <div className="pointer-events-none absolute z-[110] inset-0 flex items-start justify-end p-4 sm:p-6"><GangPanel /></div>}
      {panel === "voice" && <div className="pointer-events-none absolute z-[110] inset-0 flex items-center justify-center p-4"><VoicePanel /></div>}
    </>
  );
}
