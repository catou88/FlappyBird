import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";
import { ScoreStore } from "../src/score-store.js";

let baseUrl;
let server;
let dataFile;

before(async () => {
  const directory = await mkdtemp(join(tmpdir(), "flappy-bird-"));
  dataFile = join(directory, "scores.json");
  const store = new ScoreStore(dataFile);
  await store.initialize();
  server = createServer(createApp({ store, rateLimitMax: 1_000 }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test("health endpoint reports status", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", scores: 0 });
});

test("scores are validated, persisted, and ranked", async () => {
  const invalid = await fetch(`${baseUrl}/api/scores`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerName: "Pumpkin", score: -1 }),
  });
  assert.equal(invalid.status, 400);

  for (const score of [7, 13]) {
    const response = await fetch(`${baseUrl}/api/scores`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerName: "Pumpkin", score }),
    });
    assert.equal(response.status, 201);
  }

  const leaderboardResponse = await fetch(`${baseUrl}/api/scores?limit=1`);
  const leaderboard = await leaderboardResponse.json();
  assert.equal(leaderboard.leaderboard.length, 1);
  assert.equal(leaderboard.leaderboard[0].score, 13);
  assert.equal(leaderboard.leaderboard[0].rank, 1);

  const bestResponse = await fetch(`${baseUrl}/api/players/pumpkin/best`);
  assert.equal(bestResponse.status, 200);
  assert.equal((await bestResponse.json()).score.score, 13);

  const persisted = JSON.parse(await readFile(dataFile, "utf8"));
  assert.equal(persisted.length, 2);
});

test("unknown routes return JSON 404 responses", async () => {
  const response = await fetch(`${baseUrl}/missing`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Route not found" });
});
