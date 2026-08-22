import test from "node:test";
import assert from "node:assert/strict";
import { formatHelpMessage, PLAYER_COMMANDS } from "../src/help-message.js";

test("formats every player chat command", () => {
  assert.equal(
    formatHelpMessage(),
    `Commands | ${PLAYER_COMMANDS
      .map(({ name, description }) => `${name} - ${description}`)
      .join(" | ")}`
  );
  assert.deepEqual(PLAYER_COMMANDS.map(({ name }) => name), ["/help", "/quests"]);
});
