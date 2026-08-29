import { create } from "zustand";

export type Panel = "none" | "quests" | "gang" | "minimap" | "profile" | "voice" | "settings";

type OverlayState = {
  interactive: boolean;
  gameProcessConnected: boolean;
  gameForeground: boolean;
  shuttingDown: boolean;
  runtimeReady: boolean;
  runtimeError: string | null;
  panel: Panel;
  gangOpen: boolean;
  expandedMinimapOpen: boolean;
  setInteractive(interactive: boolean): void;
  setGameProcessConnected(connected: boolean): void;
  setGameForeground(foreground: boolean): void;
  setRuntimeState(ready: boolean, error?: string): void;
  setShuttingDown(shuttingDown: boolean): void;
  openPanel(panel: Panel): void;
  closePanel(panel?: Panel): void;
};

export const useOverlayStore = create<OverlayState>((set) => ({
  interactive: false,
  gameProcessConnected: false,
  gameForeground: false,
  shuttingDown: false,
  runtimeReady: typeof window === "undefined" || !window.chrome?.webview,
  runtimeError: null,
  panel: "none",
  gangOpen: false,
  expandedMinimapOpen: false,
  setInteractive: (interactive) => set((state) => {
    if (state.interactive === interactive) return state;
    return {
      interactive,
      panel: interactive ? state.panel : "none",
      gangOpen: interactive ? state.gangOpen : false,
      expandedMinimapOpen: false,
    };
  }),
  setGameProcessConnected: (gameProcessConnected) => set({ gameProcessConnected }),
  setGameForeground: (gameForeground) => set({ gameForeground }),
  setRuntimeState: (runtimeReady, runtimeError) => set({ runtimeReady, runtimeError: runtimeError ?? null }),
  setShuttingDown: (shuttingDown) => set({ shuttingDown }),
  openPanel: (panel) => set(panel === "minimap"
    ? { expandedMinimapOpen: true }
    : panel === "gang" ? { gangOpen: true } : { panel }),
  closePanel: (panel) => set((state) => panel === "gang"
    ? { gangOpen: false }
    : panel === "minimap"
      ? { expandedMinimapOpen: false }
      : { panel: "none", expandedMinimapOpen: panel ? state.expandedMinimapOpen : false, gangOpen: panel ? state.gangOpen : false }),
}));
