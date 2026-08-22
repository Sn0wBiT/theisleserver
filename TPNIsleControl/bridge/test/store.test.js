import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JsonStore } from "../src/store.js";

test("writes batched state changes once at the end of a batch", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tpnislecontrol-store-"));
  const file = path.join(directory, "state.json");
  const store = new JsonStore(file);
  let writes = 0;
  const originalWrite = store.write.bind(store);
  store.write = () => {
    writes += 1;
    originalWrite();
  };

  store.batch(() => {
    store.data.tokenBalances.one = 1;
    store.save();
    store.data.tokenBalances.two = 2;
    store.save();
  });

  assert.equal(writes, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")).tokenBalances, {
    one: 1,
    two: 2
  });
});
