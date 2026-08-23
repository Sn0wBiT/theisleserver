import test from "node:test";
import assert from "node:assert/strict";
import { formatQuestMessage, formatQuestMessages } from "../src/quest-message.js";

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

  assert.match(message, /Daily: Play for 30 minutes 12\/30/);
  assert.match(message, /Daily: Reach 75% growth 75\/75% \(.+\)/);
  assert.match(message, /Weekly: Kill 3 players 3\/3 \(.+\)/);
  assert.match(message, /Monthly: Play for 10 hours 2\.5\/10/);
  assert.match(message, /Tokens: 175$/);
});

test("shows an explicit empty state", () => {
  const message = formatQuestMessage([], 0);
  assert.match(message, /^.+ \| .+ \| Tokens: 0$/);
});

test("shows an acceptance instruction for an unaccepted quest", () => {
  const message = formatQuestMessage([{
    id: "daily_play_30", name: "Play", period: "daily", type: "play_seconds",
    target: 60, progress: 0, accepted: false
  }], 0);
  assert.match(message, /\[daily_play_30\].+\/accept daily_play_30/);
});

test("splits long quest lists on quest boundaries", () => {
  const messages = formatQuestMessages(Array.from({ length: 4 }, (_, index) => ({
    id: `quest_${index}`, name: `Quest ${index}`, period: "daily", type: "player_kills",
    target: 3, progress: 0, accepted: false
  })), 0, 105);
  assert.ok(messages.length > 1);
  assert.ok(messages.every((message) => message.length <= 105));
  assert.match(messages.at(-1), /Tokens: 0/);
});
