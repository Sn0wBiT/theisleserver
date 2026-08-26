import test from "node:test";
import assert from "node:assert/strict";
import { PostgresStore } from "../src/postgres-store.js";

test("batches distinct dinosaur snapshots for the same player", async () => {
  const queries = [];
  const pool = {
    query(sql, parameters) {
      queries.push({ sql, parameters });
      return Promise.resolve({ rows: [] });
    }
  };
  const store = new PostgresStore(pool, 5000);

  store.saveSnapshot("steam-1", { dinosaurId: "dino-a", ts: 1, species: "Omniraptor" });
  store.saveSnapshot("steam-1", { dinosaurId: "dino-b", ts: 2, species: "Diabloceratops" });
  await store.flushSnapshots();

  assert.equal(queries.length, 1);
  const rows = JSON.parse(queries[0].parameters[0]);
  assert.deepEqual(rows.map(({ dinosaur_id }) => dinosaur_id), ["dino-a", "dino-b"]);
  assert.match(queries[0].sql, /ON CONFLICT \(steam_id, dinosaur_id\)/);
});

test("uses the compatibility dinosaur slot when no stable ID is supplied", async () => {
  let rows;
  let statement;
  const pool = {
    query(sql, parameters) {
      statement = sql;
      rows = JSON.parse(parameters[0]);
      return Promise.resolve({ rows: [] });
    }
  };
  const store = new PostgresStore(pool, 5000);

  store.saveSnapshot("steam-1", { ts: 1 });
  await store.flushSnapshots();

  assert.equal(rows[0].dinosaur_id, undefined);
  assert.match(statement, /'legacy'/);
});

test("maps position timestamps to the database field name", async () => {
  let rows;
  const pool = {
    query(sql, parameters) {
      rows = JSON.parse(parameters[0]);
      return Promise.resolve({ rows: [] });
    }
  };
  const store = new PostgresStore(pool, 5000);

  await store.upsertPositions([{
    steam: "steam-1",
    dinosaurId: "dino-a",
    x: 1,
    y: 2,
    z: 3,
    updatedAt: 1700000000000
  }]);

  assert.equal(rows[0].dinosaur_id, "dino-a");
  assert.equal(rows[0].updated_at, 1700000000000);
});

test("continues serialized work after an operation rejects", async () => {
  const store = new PostgresStore({});
  await assert.rejects(store.enqueue(() => Promise.reject(new Error("failed"))), /failed/);
  assert.equal(await store.enqueue(() => 42), 42);
});

test("retains failed snapshot batches and preserves newer writes during a flush", async () => {
  let rejectWrite;
  const store = new PostgresStore({ query: () => new Promise((resolve, reject) => { rejectWrite = reject; }) }, 5000);
  store.saveSnapshot("steam-1", { dinosaurId: "dino", ts: 1 });
  const flushing = store.flushSnapshots();
  await new Promise((resolve) => setImmediate(resolve));
  store.saveSnapshot("steam-1", { dinosaurId: "dino", ts: 2 });
  rejectWrite(new Error("database-down"));
  await assert.rejects(flushing, /database-down/);
  assert.equal(store.dirtySnapshots.get("steam-1:dino").ts, 2);
  clearTimeout(store.snapshotTimer);
});

test("snapshot upserts guard against timestamp regression", async () => {
  let statement;
  const store = new PostgresStore({ query(sql) { statement = sql; return Promise.resolve({ rows: [] }); } });
  await store.upsertSnapshots([{ steam: "s", dinosaurId: "d", ts: 1 }]);
  assert.match(statement, /tpn_dinosaurs\.snapshot_at <= EXCLUDED\.snapshot_at/);
});
