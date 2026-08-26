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

test("does not advance a quest until the player accepts it", async () => {
  const quests = engine();
  quests.onPlayerKill("player-1");
  assert.equal(quests.getPlayerState("player-1")[0].progress, 0);
  assert.equal(quests.getPlayerState("player-1")[0].accepted, false);

  assert.deepEqual(await quests.accept("player-1", "kills-one"), {
    ok: true, questId: "kills-one", accepted: true
  });
  quests.onPlayerKill("player-1");
  const state = quests.getPlayerState("player-1")[0];
  assert.equal(state.progress, 1);
  assert.equal(state.completed, true);
});

test("cannot claim a quest that was not accepted", async () => {
  assert.deepEqual(await engine().claim("player-1", "kills-one"), {
    ok: false, error: "not-accepted"
  });
});

test("records AI dinosaur kills only for accepted AI-kill quests", async () => {
  const store = { data: { questProgress: {}, tokenBalances: {}, lastSnapshots: {} }, save() {} };
  const quests = new QuestEngine([{
    id: "ai-one", name: "AI", period: "daily", type: "ai_dinosaur_kills", target: 1
  }], store);
  quests.onAiDinosaurKill("player-1", "BP_Tyrannosaurus_C");
  assert.equal(quests.getPlayerState("player-1")[0].progress, 0);
  await quests.accept("player-1", "ai-one");
  quests.onAiDinosaurKill("player-1", "BP_Tyrannosaurus_C");
  assert.equal(quests.getPlayerState("player-1")[0].completed, true);
});

test("only credits a species-specific hunt for its configured species", async () => {
  const store = { data: { questProgress: {}, tokenBalances: {}, lastSnapshots: {} }, save() {} };
  const quests = new QuestEngine([{
    id: "hunt-trex", name: "T-Rex", period: "weekly", type: "ai_dinosaur_kills",
    targetSpecies: "Tyrannosaurus", target: 1
  }], store);
  await quests.accept("player-1", "hunt-trex");
  quests.onAiDinosaurKill("player-1", "BP_Allosaurus_C");
  assert.equal(quests.getPlayerState("player-1")[0].progress, 0);
  quests.onAiDinosaurKill("player-1", "BP_Tyrannosaurus_C");
  assert.equal(quests.getPlayerState("player-1")[0].completed, true);
});

test("allows missions with no take requirement at any growth", async () => {
  const quests = engine();
  assert.equal(quests.getPlayerState("new-player")[0].canAccept, true);
  assert.equal((await quests.accept("new-player", "kills-one")).ok, true);
});

test("returns the player's current dinosaur from the latest snapshot", () => {
  const quests = engine();
  assert.equal(quests.getCurrentDinosaur("player-1"), null);

  quests.onSnapshot({ steam: "player-1", ts: 123, species: "Omniraptor", growth: 0.25 });
  assert.deepEqual(quests.getCurrentDinosaur("player-1"), {
    dinosaurId: null, species: "Omniraptor", growth: 0.25, snapshotAt: 123,
    vitals: { hp: null, hpMax: null, hunger: null, hungerMax: null, thirst: null, thirstMax: null, stamina: null, staminaMax: null }
  });
});

test("requires the current dinosaur to reach the configured growth before acceptance", async () => {
  const store = { data: { questProgress: {}, tokenBalances: {}, lastSnapshots: {} }, save() {} };
  const quests = new QuestEngine([{
    id: "grown-dino", name: "Grown dinosaur", period: "daily", type: "player_kills",
    target: 1, takeRequirement: { minimumGrowth: 0.1 }
  }], store);

  assert.deepEqual(await quests.accept("player-1", "grown-dino"), {
    ok: false,
    error: "growth-requirement-not-met",
    requiredGrowth: 0.1,
    currentGrowth: null
  });

  quests.onSnapshot({ steam: "player-1", ts: 1, growth: 0.099 });
  assert.equal(quests.getPlayerState("player-1")[0].canAccept, false);
  assert.equal((await quests.accept("player-1", "grown-dino")).error, "growth-requirement-not-met");

  quests.onSnapshot({ steam: "player-1", ts: 2, growth: 0.1 });
  assert.equal(quests.getPlayerState("player-1")[0].canAccept, true);
  assert.equal((await quests.accept("player-1", "grown-dino")).ok, true);

  quests.onSnapshot({ steam: "player-1", ts: 3, growth: 0.01 });
  assert.deepEqual(await quests.accept("player-1", "grown-dino"), {
    ok: false, error: "already-accepted"
  });
});

test("persists only the records changed by quest operations", async () => {
  const calls = [];
  const store = {
    data: { questProgress: {}, tokenBalances: {}, lastSnapshots: {} },
    saveQuest(key) { calls.push(["quest", key]); },
    saveSnapshot(steam) { calls.push(["snapshot", steam]); },
    claimQuest(key, steam, reward) { calls.push(["claim", key, steam]); return reward; }
  };
  const quests = new QuestEngine([{
    id: "kills-one", name: "Kill one", period: "daily", type: "player_kills",
    target: 1, rewardTokens: 10
  }], store);

  quests.onSnapshot({ steam: "player-1", ts: 1, growth: 0.2 });
  await quests.accept("player-1", "kills-one");
  quests.onPlayerKill("player-1");
  await quests.claim("player-1", "kills-one");

  assert.equal(calls.filter(([type]) => type === "snapshot").length, 1);
  assert.equal(calls.filter(([type]) => type === "quest").length, 2);
  assert.equal(calls.filter(([type]) => type === "claim").length, 1);
});

test("rejects stale snapshots but accepts equal timestamps", () => {
  const quests = engine();
  assert.equal(quests.onSnapshot({ steam: "player-1", ts: 10, growth: 0.5 }), true);
  assert.equal(quests.onSnapshot({ steam: "player-1", ts: 9, growth: 0.1 }), false);
  assert.equal(quests.getCurrentDinosaur("player-1").growth, 0.5);
  assert.equal(quests.onSnapshot({ steam: "player-1", ts: 10, growth: 0.6 }), true);
  assert.equal(quests.getCurrentDinosaur("player-1").growth, 0.6);
});

test("does not mutate acceptance state when persistence fails", async () => {
  const quests = engine();
  quests.store.saveQuest = () => Promise.reject(new Error("database-down"));
  await assert.rejects(quests.accept("player-1", "kills-one"), /database-down/);
  assert.equal(quests.getPlayerState("player-1")[0].accepted, false);
});
