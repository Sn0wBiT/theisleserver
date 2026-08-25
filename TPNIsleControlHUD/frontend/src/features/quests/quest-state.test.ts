import { describe, expect, it } from "vitest";
import { questAction } from "./quest-state";
import type { Quest } from "./types";

const quest = { id: "q", name: "Q", period: "daily", type: "play_seconds", target: 1, progress: 0, rewardTokens: 1, completed: false, claimed: false } satisfies Quest;

describe("quest actions", () => {
  it("covers acceptance, progress, claimable, and claimed transitions", () => {
    expect(questAction({ ...quest, accepted: false, canAccept: false })).toBe("ineligible");
    expect(questAction({ ...quest, accepted: false, canAccept: true })).toBe("accept");
    expect(questAction({ ...quest, accepted: true })).toBe("incomplete");
    expect(questAction({ ...quest, accepted: true, completed: true })).toBe("claim");
    expect(questAction({ ...quest, accepted: true, completed: true, claimed: true })).toBe("claimed");
  });
});
