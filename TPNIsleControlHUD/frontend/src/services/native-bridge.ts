import { useOverlayStore } from "@/stores/overlay.store";

type NativeEvent =
  | { type: "overlay.modeChanged"; mode: "hud" | "interactive" }
  | { type: "game.connected" }
  | { type: "game.disconnected" }
  | { type: "game.foregroundChanged"; foreground: boolean };

export function postNativeMessage(message: object) {
  window.chrome?.webview?.postMessage(message);
}

export function bindNativeBridge() {
  const webview = window.chrome?.webview;
  if (!webview) {
    useOverlayStore.getState().setInteractive(true);
    return () => undefined;
  }

  const handleMessage = (event: MessageEvent<unknown>) => {
    if (!event.data || typeof event.data !== "object" || !("type" in event.data)) return;
    const message = event.data as NativeEvent;
    const store = useOverlayStore.getState();
    if (message.type === "overlay.modeChanged") store.setInteractive(message.mode === "interactive");
    if (message.type === "game.connected") store.setGameConnected(true);
    if (message.type === "game.disconnected") store.setGameConnected(false);
  };

  webview.addEventListener("message", handleMessage);
  postNativeMessage({ type: "app.getVersion" });
  return () => webview.removeEventListener("message", handleMessage);
}

export function closeInteractiveMode() {
  postNativeMessage({ type: "overlay.closePanel" });
  useOverlayStore.getState().setInteractive(false);
}
