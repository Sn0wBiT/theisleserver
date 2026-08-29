import { ClipboardList, MapIcon, Users } from "lucide-react";
import { isUiDevelopment } from "@/config/ui-development";
import { CompactMinimap } from "@/features/minimap/CompactMinimap";
import { DinoStatusHud } from "@/features/dino/DinoStatusHud";
import { usePositionStream } from "@/features/minimap/usePositionStream";
import { cn } from "@/lib/utils";
import { postNativeMessage } from "@/services/native-bridge";
import { useOverlayStore } from "@/stores/overlay.store";

export function HudLayer() {
  const { dinosaur, playerPresent } = usePositionStream();
  const interactive = useOverlayStore((state) => state.interactive);
  const expandedMinimapOpen = useOverlayStore((state) => state.expandedMinimapOpen);
  const setInteractive = useOverlayStore((state) => state.setInteractive);
  const openPanel = useOverlayStore((state) => state.openPanel);
  
  const openInteractive = () => {
    postNativeMessage({ type: "overlay.setInteractive", value: true });
    setInteractive(true);
    openPanel("quests");
  };

  const openMap = () => {
    postNativeMessage({ type: "overlay.openMap" });
    setInteractive(true);
    openPanel("minimap");
  }

  const openGang = () => {
    postNativeMessage({ type: "overlay.setInteractive", value: true });
    setInteractive(true);
    openPanel("gang");
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {(isUiDevelopment || (playerPresent && dinosaur)) && <DinoStatusHud draggable={interactive} status={dinosaur ? {
        dinosaurId: dinosaur.dinosaurId,
        species: dinosaur.species ?? "Unknown species",
        variant: "Current player dino",
        health: dinosaur.vitals?.hp ?? null,
        maxHealth: dinosaur.vitals?.hpMax ?? null,
        stamina: dinosaur.vitals?.staminaMax ? ((dinosaur.vitals.stamina ?? 0) / dinosaur.vitals.staminaMax) * 100 : null,
        growth: dinosaur.growth === null ? null : dinosaur.growth * 100,
        hunger: dinosaur.vitals?.hungerMax ? ((dinosaur.vitals.hunger ?? 0) / dinosaur.vitals.hungerMax) * 100 : null,
        thirst: dinosaur.vitals?.thirstMax ? ((dinosaur.vitals.thirst ?? 0) / dinosaur.vitals.thirstMax) * 100 : null,
      } : undefined} />}
      {/* Menus */}
      <div
        id="btn-list"
        className={cn(
          "absolute top-6 z-100 flex flex-col gap-2",
          expandedMinimapOpen ? "left-4" : "left-[calc(24px+clamp(210px,18vw,280px)+8px)]",
        )}
      >
        {/* Map */}
        <button
          type="button"
          className="pointer-events-auto flex hidden cursor-pointer items-center gap-2 rounded-full border border-stone bg-charcoal/90 p-2 text-left text-bone shadow-hud transition-all duration-300 ease-out hover:border-amber focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber"
          onClick={openMap}
          aria-label="Mở bản đồ"
        >
          <MapIcon className="size-4 text-moss" />
          <div className="absolute -bottom-10 text-shadow-moss hidden">
            <span className="block text-[9px] uppercase tracking-[0.18em] text-ash">M - Bản đồ</span>
          </div>
        </button>
        {/* Gang */}
        <button
          type="button"
          className={cn("position relative pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border border-stone bg-charcoal/90 p-2 text-left text-bone shadow-hud transition-all duration-300 ease-out hover:border-amber focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber", {
            "-left-8": !expandedMinimapOpen
          })}
          onClick={openGang}
          aria-label="Mở bảng bầy đàn"
        >
          <Users className="size-4 text-moss" />
          <div className="absolute -bottom-4 text-center w-full left-0 text-shadow-moss "><span className="block text-[9px] uppercase tracking-[0.18em] text-ash">F7</span></div>
        </button>
        {/* Quests */}
        <button
          type="button"
          className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full border border-stone bg-charcoal/90 p-2 text-left text-bone shadow-hud transition-all duration-300 ease-out hover:border-amber focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber"
          onClick={openInteractive}
          aria-label="Mở bảng nhiệm vụ"
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
