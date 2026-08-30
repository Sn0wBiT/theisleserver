import test from "node:test";
import assert from "node:assert/strict";
import { VoiceCoordinator, proximityGain, relativeDirection } from "../src/voice-coordinator.js";

test("gain is full through 5m and fades linearly to silence at 30m", () => {
  assert.equal(proximityGain(5), 1);
  assert.equal(proximityGain(17.5), .5);
  assert.equal(proximityGain(30), 0);
});

test("coordinator rejects stale/cross-server users and converts Unreal units", () => {
  let now = 10_000;
  const voice = new VoiceCoordinator({ gameServerId: "gateway-1", now: () => now });
  const base = { rotation: { pitch: 0, yaw: 0, roll: 0 }, updatedAt: now, gameServerId: "gateway-1" };
  voice.update("1", { ...base, pos: { x: 0, y: 0, z: 0 } });
  voice.update("2", { ...base, pos: { x: 500, y: 0, z: 0 } });
  voice.update("3", { ...base, gameServerId: "other", pos: { x: 0, y: 0, z: 0 } });
  assert.deepEqual(voice.stateFor("1").audibleSpeakers.map((speaker) => speaker.identity), ["2"]);
  now += 5001;
  assert.equal(voice.stateFor("1").ready, false);
});

test("direction is listener-relative after yaw rotation", () => {
  const listener = { pos: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0, yaw: 90, roll: 0 } };
  const direction = relativeDirection(listener, { pos: { x: 0, y: 100, z: 0 } });
  assert.ok(Math.abs(direction.x - 1) < 1e-9);
  assert.ok(Math.abs(direction.y) < 1e-9);
});
