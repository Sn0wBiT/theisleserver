import { ClipboardList, MapIcon } from "lucide-react";
import { CompactMinimap } from "@/features/minimap/CompactMinimap";
import { cn } from "@/lib/utils";
import { postNativeMessage } from "@/services/native-bridge";
import { useOverlayStore } from "@/stores/overlay.store";

export function HudLayer() {
  const interactive = useOverlayStore((state) => state.interactive);
  const expandedMinimapOpen = useOverlayStore((state) => state.expandedMinimapOpen);
  const setInteractive = useOverlayStore((state) => state.setInteractive);
  const openPanel = useOverlayStore((state) => state.openPanel);
  
  const openInteractive = () => {
    postNativeMessage({ type: "overlay.setInteractive", value: true });
    setInteractive(true);
  };

  const openMap = () => {
    postNativeMessage({ type: "overlay.openMap" });
    setInteractive(true);
    openPanel("minimap");
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Menus */}
      <div id="btn-list" className="relative z-100 left-4">
        <button
          type="button"
          className={cn(
            "pointer-events-auto top-4 flex cursor-pointer items-center gap-2 rounded-full border border-stone bg-charcoal/90 p-2 text-left text-bone shadow-hud transition-all duration-300 ease-out hover:border-amber focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber",
            expandedMinimapOpen ? "relative" : "absolute ",
          )}
          onClick={openMap}
          aria-label="Mở bản đồ"
          disabled={interactive}
        >
          <MapIcon className="size-4 text-moss" />
          <div className="absolute -bottom-10 text-shadow-moss hidden">
            <span className="block text-[9px] uppercase tracking-[0.18em] text-ash">M - Bản đồ</span>
          </div>
        </button>
        <button
          type="button"
          className={cn(
            "pointer-events-auto top-4 flex cursor-pointer items-center gap-2 rounded-full border border-stone bg-charcoal/90 p-2 text-left text-bone shadow-hud transition-all duration-300 ease-out hover:border-amber focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber",
            expandedMinimapOpen ? "relative" : "absolute left-49",
          )}
          onClick={openInteractive}
          aria-label="Mở bảng nhiệm vụ"
          disabled={interactive}
        >
          <ClipboardList className="size-4 text-moss" />
          <div className="absolute -bottom-10 text-shadow-moss hidden">
            <span className="block text-[9px] uppercase tracking-[0.18em] text-ash">F6 - Nhiệm vụ</span>
          </div>
        </button>
      </div>
      {/* Minimap */}
      {!expandedMinimapOpen && (
        <div className={cn(interactive ? "pointer-events-auto" : "pointer-events-none", 'relative z-10')}>
          <CompactMinimap />
        </div>
      )}
    </div>
  );
}
