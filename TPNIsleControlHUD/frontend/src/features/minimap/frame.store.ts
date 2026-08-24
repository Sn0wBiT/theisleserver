import { create } from "zustand";

export type MinimapFrame = "square" | "circle";
const STORAGE_KEY = "tpn-minimap-frame";

export function isMinimapFrame(value: unknown): value is MinimapFrame {
  return value === "square" || value === "circle";
}

function savedFrame(): MinimapFrame {
  if (typeof window === "undefined") return "circle";
  const value = window.localStorage.getItem(STORAGE_KEY);
  return isMinimapFrame(value) ? value : "circle";
}

export const useMinimapFrameStore = create<{
  frame: MinimapFrame;
  setFrame(frame: MinimapFrame): void;
}>((set) => ({
  frame: savedFrame(),
  setFrame: (frame) => {
    window.localStorage.setItem(STORAGE_KEY, frame);
    set({ frame });
  },
}));
