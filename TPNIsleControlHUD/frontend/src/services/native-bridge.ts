import { useOverlayStore } from "@/stores/overlay.store";
import { apiUrl, setApiUrl } from "@/services/api";

export type NativeEvent =
  | { type: "overlay.modeChanged"; mode: "hud" | "interactive" }
  | { type: "overlay.openPanel"; panel: "minimap" }
  | { type: "game.connected" }
  | { type: "game.disconnected" }
  | { type: "game.foregroundChanged"; foreground: boolean }
  | { type: "app.shuttingDown" }
  | { type: "app.config"; apiUrl: string };

export function postNativeMessage(message: object) {
  window.chrome?.webview?.postMessage(message);
}

export function handleNativeEvent(message: NativeEvent) {
  const store = useOverlayStore.getState();
  if (message.type === "overlay.modeChanged") store.setInteractive(message.mode === "interactive");
  if (message.type === "overlay.openPanel") store.openPanel(message.panel);
  if (message.type === "game.connected") store.setGameProcessConnected(true);
  if (message.type === "game.disconnected") store.setGameProcessConnected(false);
  if (message.type === "game.foregroundChanged") store.setGameForeground(message.foreground);
  if (message.type === "app.shuttingDown") store.setShuttingDown(true);
  if (message.type === "app.config") {
    try { setApiUrl(message.apiUrl); store.setRuntimeState(true); }
    catch { store.setRuntimeState(false, "The HUD runtime API origin is invalid."); }
  }
}

export function bindNativeBridge() {
  const webview = window.chrome?.webview;
  if (!webview) {
    const store = useOverlayStore.getState();
    store.setInteractive(true);
    try { setApiUrl(apiUrl); store.setRuntimeState(true); }
    catch { store.setRuntimeState(false, "The browser API origin is invalid."); }
    return () => undefined;
  }

  const handleMessage = (event: MessageEvent<unknown>) => {
    if (!event.data || typeof event.data !== "object" || !("type" in event.data)) return;
    const message = event.data as NativeEvent;
    handleNativeEvent(message);
  };

  webview.addEventListener("message", handleMessage);
  postNativeMessage({ type: "app.getVersion" });
  return () => webview.removeEventListener("message", handleMessage);
}

export function openLogin(browserCode: string) {
  if (window.chrome?.webview) postNativeMessage({ type: "app.openLogin", browserCode });
  else window.open(`${apiUrl}/hud/connect?code=${encodeURIComponent(browserCode)}`, "_blank", "noopener,noreferrer");
}

export function closeInteractiveMode() {
  postNativeMessage({ type: "overlay.closePanel" });
  useOverlayStore.getState().setInteractive(false);
}
