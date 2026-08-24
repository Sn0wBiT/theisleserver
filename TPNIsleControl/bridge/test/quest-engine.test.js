import test from "node:test";
import assert from "node:assert/strict";
import { QuestEngine } from "../src/quest-engine.js";

function engine() {
  const store = {
    data: { questProgress: {}, tokenBalances: {}, lastSnapshots: {} },
    save() {}
  };
  return new QuestEngine([{
    id: "kills-one", name: "Kill one", period: "daily", type: "player_kills",
    target: 1, rewardTokens: 10
  }], store);
}

test("does not advance a quest until the player accepts it", () => {
  const quests = engine();
  quests.onPlayerKill("player-1");
  assert.equal(quests.getPlayerState("player-1")[0].progress, 0);
  assert.equal(quests.getPlayerState("player-1")[0].accepted, false);

  assert.deepEqual(quests.accept("player-1", "kills-one"), {
    ok: true, questId: "kills-one", accepted: true
  });
  quests.onPlayerKill("player-1");
  const state = quests.getPlayerState("player-1")[0];
  assert.equal(state.progress, 1);
  assert.equal(state.completed, true);
});

test("cannot claim a quest that was not accepted", () => {
  assert.deepEqual(engine().claim("player-1", "kills-one"), {
    ok: false, error: "not-accepted"
  });
});

test("records AI dinosaur kills only for accepted AI-kill quests", () => {
  const store = { data: { questProgress: {}, tokenBalances: {}, lastSnapshots: {} }, save() {} };
  const quests = new QuestEngine([{
    id: "ai-one", name: "AI", period: "daily", type: "ai_dinosaur_kills", target: 1
  }], store);
  quests.onAiDinosaurKill("player-1", "BP_Tyrannosaurus_C");
  assert.equal(quests.getPlayerState("player-1")[0].progress, 0);
  quests.accept("player-1", "ai-one");
  quests.onAiDinosaurKill("player-1", "BP_Tyrannosaurus_C");
  assert.equal(quests.getPlayerState("player-1")[0].completed, true);
});

test("only credits a species-specific hunt for its configured species", () => {
  const store = { data: { questProgress: {}, tokenBalances: {}, lastSnapshots: {} }, save() {} };
  const quests = new QuestEngine([{
    id: "hunt-trex", name: "T-Rex", period: "weekly", type: "ai_dinosaur_kills",
    targetSpecies: "Tyrannosaurus", target: 1
  }], store);
  quests.accept("player-1", "hunt-trex");
  quests.onAiDinosaurKill("player-1", "BP_Allosaurus_C");
  assert.equal(quests.getPlayerState("player-1")[0].progress, 0);
  quests.onAiDinosaurKill("player-1", "BP_Tyrannosaurus_C");
  assert.equal(quests.getPlayerState("player-1")[0].completed, true);
});

test("allows missions with no take requirement at any growth", () => {
  const quests = engine();
  assert.equal(quests.getPlayerState("new-player")[0].canAccept, true);
  assert.equal(quests.accept("new-player", "kills-one").ok, true);
});

test("returns the player's current dinosaur from the latest snapshot", () => {
  const quests = engine();
  assert.equal(quests.getCurrentDinosaur("player-1"), null);

  quests.onSnapshot({ steam: "player-1", ts: 123, species: "Omniraptor", growth: 0.25 });
  assert.deepEqual(quests.getCurrentDinosaur("player-1"), {
    species: "Omniraptor", growth: 0.25, snapshotAt: 123
  });
});

test("requires the current dinosaur to reach the configured growth before acceptance", () => {
  const store = { data: { questProgress: {}, tokenBalances: {}, lastSnapshots: {} }, save() {} };
  const quests = new QuestEngine([{
    id: "grown-dino", name: "Grown dinosaur", period: "daily", type: "player_kills",
    target: 1, takeRequirement: { minimumGrowth: 0.1 }
  }], store);

  assert.deepEqual(quests.accept("player-1", "grown-dino"), {
    ok: false,
    error: "growth-requirement-not-met",
    requiredGrowth: 0.1,
    currentGrowth: null
  });

  quests.onSnapshot({ steam: "player-1", ts: 1, growth: 0.099 });
  assert.equal(quests.getPlayerState("player-1")[0].canAccept, false);
  assert.equal(quests.accept("player-1", "grown-dino").error, "growth-requirement-not-met");

  quests.onSnapshot({ steam: "player-1", ts: 2, growth: 0.1 });
  assert.equal(quests.getPlayerState("player-1")[0].canAccept, true);
  assert.equal(quests.accept("player-1", "grown-dino").ok, true);

  quests.onSnapshot({ steam: "player-1", ts: 3, growth: 0.01 });
  assert.deepEqual(quests.accept("player-1", "grown-dino"), {
    ok: false, error: "already-accepted"
  });
});
