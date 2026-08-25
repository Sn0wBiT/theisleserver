import type { Quest } from "./types";

export type QuestAction = "accept" | "ineligible" | "incomplete" | "claim" | "claimed";

export function questAction(quest: Quest): QuestAction {
  if (quest.claimed) return "claimed";
  if (quest.accepted !== true) return quest.canAccept === true ? "accept" : "ineligible";
  return quest.completed ? "claim" : "incomplete";
}
