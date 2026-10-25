import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export class ScoreStore {
  #filePath;
  #scores = [];
  #writeQueue = Promise.resolve();

  constructor(filePath) {
    this.#filePath = filePath;
  }

  async initialize() {
    try {
      const contents = await readFile(this.#filePath, "utf8");
      const parsed = JSON.parse(contents);
      this.#scores = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await mkdir(dirname(this.#filePath), { recursive: true });
    }
  }

  async add({ playerName, score }) {
    const entry = {
      id: randomUUID(),
      playerName,
      score,
      createdAt: new Date().toISOString(),
    };
    this.#scores.push(entry);
    await this.#persist();
    return entry;
  }

  leaderboard(limit = 10) {
    return [...this.#scores]
      .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit)
      .map((entry, index) => ({ rank: index + 1, ...entry }));
  }

  playerBest(playerName) {
    const normalized = playerName.toLocaleLowerCase();
    return this.#scores
      .filter((entry) => entry.playerName.toLocaleLowerCase() === normalized)
      .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt))[0] ?? null;
  }

  count() {
    return this.#scores.length;
  }

  #persist() {
    const snapshot = JSON.stringify(this.#scores, null, 2);
    const temporaryFile = `${this.#filePath}.tmp`;
    this.#writeQueue = this.#writeQueue.then(async () => {
      await mkdir(dirname(this.#filePath), { recursive: true });
      await writeFile(temporaryFile, snapshot, "utf8");
      await rename(temporaryFile, this.#filePath);
    });
    return this.#writeQueue;
  }
}
