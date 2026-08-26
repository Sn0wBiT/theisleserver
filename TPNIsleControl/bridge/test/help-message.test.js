import test from "node:test";
import assert from "node:assert/strict";
import { formatHelpMessage, PLAYER_COMMANDS } from "../src/help-message.js";

test("formats every player chat command", () => {
  const message = formatHelpMessage();
  for (const { name, description } of PLAYER_COMMANDS) {
    assert.ok(message.includes(`${name} - ${description}`));
  }
  assert.deepEqual(PLAYER_COMMANDS.map(({ name }) => name), ["/help", "/quests [trang]", "/accept <quest-id>", "/human", "/revive"]);
  assert.ok(!message.includes("/spawnquestnpc"));
});
