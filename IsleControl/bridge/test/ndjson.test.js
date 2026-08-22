import test from "node:test";
import assert from "node:assert/strict";
import { completeNdjsonChunk } from "../src/ndjson.js";

test("retains an incomplete final NDJSON record for the next poll", () => {
  const first = Buffer.from('{"type":"snapshot","ts":1}\n{"type":"snapshot"');
  const chunk = completeNdjsonChunk(first);

  assert.equal(chunk.bytesConsumed, 27);
  assert.deepEqual(chunk.lines, ['{"type":"snapshot","ts":1}']);
  assert.equal(
    first.subarray(chunk.bytesConsumed).toString("utf8"),
    '{"type":"snapshot"'
  );
});

test("does not advance when no complete record is available", () => {
  const chunk = completeNdjsonChunk(Buffer.from('{"type":"snapshot"'));

  assert.equal(chunk.bytesConsumed, 0);
  assert.deepEqual(chunk.lines, []);
});

test("accepts complete CRLF-delimited records", () => {
  const input = Buffer.from('{"a":1}\r\n{"b":2}\r\n');
  const chunk = completeNdjsonChunk(input);

  assert.equal(chunk.bytesConsumed, input.length);
  assert.deepEqual(chunk.lines, ['{"a":1}', '{"b":2}']);
});
