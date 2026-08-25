import { create } from "zustand";

export type Panel = "none" | "quests" | "minimap" | "profile" | "voice" | "settings";

type OverlayState = {
  interactive: boolean;
  gameProcessConnected: boolean;
  gameForeground: boolean;
  shuttingDown: boolean;
  runtimeReady: boolean;
  runtimeError: string | null;
  panel: Panel;
  setInteractive(interactive: boolean): void;
  setGameProcessConnected(connected: boolean): void;
  setGameForeground(foreground: boolean): void;
  setRuntimeState(ready: boolean, error?: string): void;
  setShuttingDown(shuttingDown: boolean): void;
  openPanel(panel: Panel): void;
  closePanel(): void;
};

export const useOverlayStore = create<OverlayState>((set) => ({
  interactive: false,
  gameProcessConnected: false,
  gameForeground: false,
  shuttingDown: false,
  runtimeReady: typeof window === "undefined" || !window.chrome?.webview,
  runtimeError: null,
  panel: "none",
  setInteractive: (interactive) => set({ interactive, panel: interactive ? "quests" : "none" }),
  setGameProcessConnected: (gameProcessConnected) => set({ gameProcessConnected }),
  setGameForeground: (gameForeground) => set({ gameForeground }),
  setRuntimeState: (runtimeReady, runtimeError) => set({ runtimeReady, runtimeError: runtimeError ?? null }),
  setShuttingDown: (shuttingDown) => set({ shuttingDown }),
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: "none" }),
}));
