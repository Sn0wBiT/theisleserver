import { create } from "zustand";

export type Panel = "none" | "quests" | "minimap" | "profile" | "voice" | "settings";

type OverlayState = {
  interactive: boolean;
  gameConnected: boolean;
  shuttingDown: boolean;
  panel: Panel;
  setInteractive(interactive: boolean): void;
  setGameConnected(connected: boolean): void;
  setShuttingDown(shuttingDown: boolean): void;
  openPanel(panel: Panel): void;
  closePanel(): void;
};

export const useOverlayStore = create<OverlayState>((set) => ({
  interactive: false,
  gameConnected: true,
  shuttingDown: false,
  panel: "none",
  setInteractive: (interactive) => set({ interactive, panel: interactive ? "quests" : "none" }),
  setGameConnected: (gameConnected) => set({ gameConnected }),
  setShuttingDown: (shuttingDown) => set({ shuttingDown }),
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: "none" }),
}));
