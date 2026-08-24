import test from "node:test";
import assert from "node:assert/strict";
import { parseGameSync, PendingCommandQueue } from "../src/game-sync.js";

test("parses a batched game sync payload", () => {
  const parsed = parseGameSync({
    snapshots: [{ steam: "1" }],
    positions: [{ steam: "1", pos: { x: 1, y: 2, z: 3 } }],
    events: [{ type: "quest_request", steam: "1" }],
    acknowledgements: [123]
  });

  assert.deepEqual(parsed, {
    snapshots: [{ steam: "1" }],
    positions: [{ steam: "1", pos: { x: 1, y: 2, z: 3 } }],
    events: [{ type: "quest_request", steam: "1" }],
    acknowledgements: ["123"]
  });
});

test("rejects oversized batches", () => {
  assert.throws(
    () => parseGameSync({ snapshots: Array(501).fill({}) }),
    /snapshots-limit-exceeded/
  );
});

test("rejects oversized position batches", () => {
  assert.throws(
    () => parseGameSync({ positions: Array(501).fill({}) }),
    /positions-limit-exceeded/
  );
});

test("retains commands until the game acknowledges them", () => {
  const queue = new PendingCommandQueue();
  queue.add({ id: "a", verb: "notify" });
  queue.add({ id: "b", verb: "heal" });

  assert.deepEqual(queue.list().map((command) => command.id), ["a", "b"]);
  queue.acknowledge(["a"]);
  assert.deepEqual(queue.list().map((command) => command.id), ["b"]);
});
