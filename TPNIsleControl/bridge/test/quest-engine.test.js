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
