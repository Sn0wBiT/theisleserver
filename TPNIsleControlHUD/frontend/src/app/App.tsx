import { useEffect } from "react";
import { HudLayer } from "@/components/hud/HudLayer";
import { NotificationLayer } from "@/components/hud/NotificationLayer";
import { PanelLayer } from "@/components/hud/PanelLayer";
import { bindNativeBridge, closeInteractiveMode } from "@/services/native-bridge";
import { useOverlayStore } from "@/stores/overlay.store";
import { AuthGate } from "@/features/auth/AuthGate";

export function App() {
  const interactive = useOverlayStore((state) => state.interactive);
  useEffect(bindNativeBridge, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && interactive) closeInteractiveMode();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [interactive]);

  return <main className="relative h-screen w-screen overflow-hidden"><AuthGate><HudLayer /><PanelLayer /></AuthGate><NotificationLayer /></main>;
}
