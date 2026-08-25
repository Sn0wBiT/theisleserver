import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiUrl } from "./api";
import { handleNativeEvent, openLogin } from "./native-bridge";
import { useOverlayStore } from "@/stores/overlay.store";

describe("native runtime bootstrap", () => {
  beforeEach(() => {
    useOverlayStore.setState({ runtimeReady: false, runtimeError: null, gameProcessConnected: false, gameForeground: false, shuttingDown: false, interactive: false, panel: "none", expandedMinimapOpen: false });
  });

  it("waits for and validates delayed native configuration", () => {
    expect(useOverlayStore.getState().runtimeReady).toBe(false);
    handleNativeEvent({ type: "app.config", apiUrl: "https://api.example" });
    expect(useOverlayStore.getState().runtimeReady).toBe(true);
    expect(apiUrl).toBe("https://api.example");
    handleNativeEvent({ type: "app.config", apiUrl: "javascript:bad" });
    expect(useOverlayStore.getState()).toMatchObject({ runtimeReady: false, runtimeError: "The HUD runtime API origin is invalid." });
  });

  it("applies the complete native ready state and shutdown", () => {
    handleNativeEvent({ type: "game.connected" });
    handleNativeEvent({ type: "game.foregroundChanged", foreground: true });
    handleNativeEvent({ type: "overlay.modeChanged", mode: "interactive" });
    handleNativeEvent({ type: "app.shuttingDown" });
    expect(useOverlayStore.getState()).toMatchObject({ gameProcessConnected: true, gameForeground: true, interactive: true, shuttingDown: true });
  });

  it("opens the expanded minimap requested by the native map hotkey", () => {
    handleNativeEvent({ type: "overlay.modeChanged", mode: "interactive" });
    handleNativeEvent({ type: "overlay.openPanel", panel: "minimap" });
    expect(useOverlayStore.getState()).toMatchObject({ interactive: true, panel: "none", expandedMinimapOpen: true });
  });

  it("opens browser login against the configured API origin", () => {
    handleNativeEvent({ type: "app.config", apiUrl: "https://login.example" });
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    openLogin("code with spaces");
    expect(open).toHaveBeenCalledWith("https://login.example/hud/connect?code=code%20with%20spaces", "_blank", "noopener,noreferrer");
    vi.unstubAllGlobals();
  });
});
