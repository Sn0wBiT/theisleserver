import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const species = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../ai-dinosaurs.json"), "utf8"));

test("contains the configured AI dinosaur species", () => {
  assert.equal(species.length, 23);
  for (const name of ["Tyrannosaurus", "Deinosuchus", "Omniraptor", "Pteranodon"]) {
    assert.ok(species.includes(name));
  }
});
