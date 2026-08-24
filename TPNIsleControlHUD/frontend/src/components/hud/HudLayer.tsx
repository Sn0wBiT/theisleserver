import { ClipboardList } from "lucide-react";
import { CompactMinimap } from "@/features/minimap/CompactMinimap";
import { postNativeMessage } from "@/services/native-bridge";
import { useOverlayStore } from "@/stores/overlay.store";

export function HudLayer() {
  const interactive = useOverlayStore((state) => state.interactive);
  const setInteractive = useOverlayStore((state) => state.setInteractive);
  const openInteractive = () => {
    postNativeMessage({ type: "overlay.setInteractive", value: true });
    setInteractive(true);
  };
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className={interactive ? "pointer-events-auto" : "pointer-events-none"}>
        <CompactMinimap />
      </div>
      {!interactive && <button type="button" className="pointer-events-auto absolute right-6 top-6 flex cursor-pointer items-center gap-2 rounded-[1px] border border-stone bg-charcoal/90 px-3 py-2 text-left text-bone shadow-hud transition-colors hover:border-amber focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber" onClick={openInteractive} aria-label="Open interactive quest panel">
        <ClipboardList className="size-4 text-moss" />
        <div><span className="block text-[9px] uppercase tracking-[0.18em] text-ash">Nhiệm vụ</span><strong className="text-xs">F6</strong></div>
      </button>}
    </div>
  );
}
