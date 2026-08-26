import { create } from "zustand";

export type MinimapFrame = "square" | "circle";
let currentFrame: MinimapFrame = "circle";

export function isMinimapFrame(value: unknown): value is MinimapFrame {
  return value === "square" || value === "circle";
}

function savedFrame(): MinimapFrame {
  return currentFrame;
}

export const useMinimapFrameStore = create<{
  frame: MinimapFrame;
  setFrame(frame: MinimapFrame): void;
}>((set) => ({
  frame: savedFrame(),
  setFrame: (frame) => {
    currentFrame = frame;
    set({ frame });
  },
}));
