import { useEffect } from "react";
import { HudLayer } from "@/components/hud/HudLayer";
import { NotificationLayer } from "@/components/hud/NotificationLayer";
import { PanelLayer } from "@/components/hud/PanelLayer";
import { bindNativeBridge, closeInteractiveMode } from "@/services/native-bridge";
import { useOverlayStore } from "@/stores/overlay.store";
import { AuthGate } from "@/features/auth/AuthGate";
import { PositionStreamProvider, usePositionStream } from "@/features/minimap/usePositionStream";

function AuthenticatedHud() {
  const { playerPresent, status } = usePositionStream();
  const interactive = useOverlayStore((state) => state.interactive);
  if (!playerPresent) {
    if (!interactive) return null;
    return <div className="absolute inset-0 grid place-items-center"><section className="hud-panel border border-stone p-5 text-sm text-bone">{status === "unauthorized" ? "Your session expired. Sign in again." : "Waiting for a fresh in-game position…"}</section></div>;
  }
  return (
    <>
      <HudLayer />
      <PanelLayer />
    </>
  );
}

export function App() {
  const interactive = useOverlayStore((state) => state.interactive);
  const runtimeReady = useOverlayStore((state) => state.runtimeReady);
  const runtimeError = useOverlayStore((state) => state.runtimeError);
  
  useEffect(bindNativeBridge, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && interactive) closeInteractiveMode();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [interactive]);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {runtimeError && (
        <div className="absolute inset-0 grid place-items-center">
          <section className="hud-panel border border-rust p-5 text-sm text-rust">{runtimeError}</section>
        </div>
      )}
      {runtimeReady && (
        <AuthGate>
          <PositionStreamProvider>
            <AuthenticatedHud />
          </PositionStreamProvider>
        </AuthGate>
      )}
      <NotificationLayer />
    </main>
  );
}
