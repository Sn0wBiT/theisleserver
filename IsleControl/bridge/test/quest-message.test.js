import test from "node:test";
import assert from "node:assert/strict";
import { formatQuestMessage } from "../src/quest-message.js";

test("formats all quest periods, progress, status, and token balance", () => {
  const message = formatQuestMessage([
    {
      name: "Play for 30 minutes",
      period: "daily",
      type: "play_seconds",
      target: 1800,
      progress: 720
    },
    {
      name: "Reach 75% growth",
      period: "daily",
      type: "reach_growth",
      target: 0.75,
      progress: 0.75,
      completed: true
    },
    {
      name: "Kill 3 players",
      period: "weekly",
      type: "player_kills",
      target: 3,
      progress: 3,
      completed: true,
      claimed: true
    },
    {
      name: "Play for 10 hours",
      period: "monthly",
      type: "play_seconds",
      target: 36000,
      progress: 9000
    }
  ], 175);

  assert.equal(
    message,
    "Quests | Daily: Play for 30 minutes 12/30 min | " +
      "Daily: Reach 75% growth 75/75% (complete) | " +
      "Weekly: Kill 3 players 3/3 (claimed) | " +
      "Monthly: Play for 10 hours 2.5/10 hr | Tokens: 175"
  );
});

test("shows an explicit empty state", () => {
  assert.equal(
    formatQuestMessage([], 0),
    "Quests | No quests are currently available | Tokens: 0"
  );
});
