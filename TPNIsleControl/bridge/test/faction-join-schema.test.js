import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schemaUrl = new URL("../sql/001_initial.sql", import.meta.url);

test("faction join request schema is idempotent and keeps one unresolved request per player", async () => {
  const sql = await readFile(schemaUrl, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tpn_faction_join_requests/);
  assert.match(sql, /status IN \('pending', 'approved', 'rejected', 'cancelled'\)/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS tpn_faction_join_requests_unresolved_player[\s\S]*WHERE status IN \('pending', 'rejected'\)/);
});

test("join requests reference a faction instead of an invite-code snapshot", async () => {
  const sql = await readFile(schemaUrl, "utf8");
  const definition = sql.match(/CREATE TABLE IF NOT EXISTS tpn_faction_join_requests \(([^;]+)\);/)?.[1] ?? "";
  assert.match(definition, /faction_id uuid NOT NULL REFERENCES tpn_factions\(id\)/);
  assert.doesNotMatch(definition, /invite_code/);
});
