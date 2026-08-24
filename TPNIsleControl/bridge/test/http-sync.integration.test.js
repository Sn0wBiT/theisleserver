import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForHealth(url, child) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`bridge exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("bridge did not become healthy");
}

test("POST /game/sync ingests a batch and acknowledges returned commands", async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tpnislecontrol-http-"));
  const port = await unusedPort();
  const configFile = path.join(directory, "config.json");
  fs.writeFileSync(configFile, JSON.stringify({
    host: "127.0.0.1",
    port,
    gameTransport: "auto",
    apiToken: "test-api-token",
    modSavedDir: path.join(directory, "ipc"),
    stateFile: path.join(directory, "state.json"),
    pollMs: 50
  }));

  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, TPNISLECONTROL_CONFIG: configFile },
    stdio: "ignore"
  });
  context.after(() => child.kill());

  const url = `http://127.0.0.1:${port}`;
  await waitForHealth(url, child);

  const now = Math.floor(Date.now() / 1000);
  const response = await fetch(`${url}/game/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      snapshots: [{ steam: "76561198000000000", ts: now, growth: 0.5 }],
      events: [{ type: "quest_request", steam: "76561198000000000", ts: now }],
      acknowledgements: []
    })
  });

  assert.equal(response.status, 200);
  const commands = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(commands.length, 1);
  const command = commands[0];
  assert.equal(command.verb, "notify");
  assert.equal(command.args.delivery, undefined);
  assert.equal(command.steam, "76561198000000000");
  assert.match(command.args.message, /Daily: .+\[daily_play_30\].+\/accept daily_play_30/);

  const positionResponse = await fetch(`${url}/game/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      positions: [{ steam: "76561198000000000", pos: { x: 100, y: 200, z: 300 } }]
    })
  });
  assert.equal(positionResponse.status, 200);

  const playersResponse = await fetch(`${url}/players`, {
    headers: { authorization: "Bearer test-api-token" }
  });
  const players = (await playersResponse.json()).players;
  assert.deepEqual(players[0].pos, { x: 100, y: 200, z: 300 });
  assert.equal(typeof players[0].positionUpdatedAt, "number");

  const acknowledged = await fetch(`${url}/game/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ acknowledgements: commands.map(({ id }) => id) })
  });
  assert.equal(acknowledged.status, 200);
  assert.equal(await acknowledged.text(), "");

  const helpResponse = await fetch(`${url}/game/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      events: [{ type: "help_request", steam: "76561198000000000", ts: now }]
    })
  });
  assert.equal(helpResponse.status, 200);
  const helpCommand = JSON.parse(await helpResponse.text());
  assert.equal(helpCommand.verb, "notify");
  assert.equal(helpCommand.args.delivery, undefined);
  assert.match(helpCommand.args.message, /\/help\s+-/);
  assert.match(helpCommand.args.message, /\/quests \[trang\]\s+-/);
  assert.match(helpCommand.args.message, /\/human\s+-/);
  assert.match(helpCommand.args.message, /\/revive\s+-/);

  const humanResponse = await fetch(`${url}/game/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      events: [{ type: "human_request", steam: "76561198000000000", ts: now }],
      acknowledgements: [helpCommand.id]
    })
  });
  assert.equal(humanResponse.status, 200);
  const humanCommand = JSON.parse(await humanResponse.text());
  assert.equal(humanCommand.verb, "human");
  assert.equal(humanCommand.steam, "76561198000000000");
  assert.deepEqual(humanCommand.args, {});

  const reviveResponse = await fetch(`${url}/game/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      events: [{ type: "revive_request", steam: "76561198000000000", ts: now }],
      acknowledgements: [humanCommand.id]
    })
  });
  assert.equal(reviveResponse.status, 200);
  const reviveCommand = JSON.parse(await reviveResponse.text());
  assert.equal(reviveCommand.verb, "revive");
  assert.equal(reviveCommand.steam, "76561198000000000");
  assert.deepEqual(reviveCommand.args, {});
});
