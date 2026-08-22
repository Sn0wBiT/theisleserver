import test from "node:test";
import assert from "node:assert/strict";
import { formatHelpMessage, PLAYER_COMMANDS } from "../src/help-message.js";

test("formats every player chat command", () => {
  const message = formatHelpMessage();
  for (const { name, description } of PLAYER_COMMANDS) {
    assert.match(message, new RegExp(`${name.replace("/", "\\/")} - ${description}`));
  }
  assert.deepEqual(PLAYER_COMMANDS.map(({ name }) => name), ["/help", "/quests", "/human", "/revive"]);
});
