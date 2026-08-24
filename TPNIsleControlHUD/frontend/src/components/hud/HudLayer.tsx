import { ClipboardList } from "lucide-react";
import { postNativeMessage } from "@/services/native-bridge";
import { useOverlayStore } from "@/stores/overlay.store";

export function HudLayer() {
  const interactive = useOverlayStore((state) => state.interactive);
  if (interactive) return null;
  return (
    <div className="pointer-events-none absolute right-6 top-6 flex items-center gap-2 rounded-[1px] border border-stone bg-charcoal/90 px-3 py-2 text-bone shadow-hud">
      <ClipboardList className="size-4 text-moss" />
      <div><span className="block text-[9px] uppercase tracking-[0.18em] text-ash">Nhiệm vụ</span><strong className="text-xs">F6</strong></div>
      <button className="sr-only" onClick={() => postNativeMessage({ type: "overlay.setInteractive", value: true })}>Mở danh sách nhiệm vụ</button>
    </div>
  );
}
