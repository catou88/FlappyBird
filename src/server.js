import { createServer } from "node:http";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { getConfig } from "./config.js";
import { ScoreStore } from "./score-store.js";

const config = getConfig();
const store = new ScoreStore(resolve(config.dataFile));
await store.initialize();

const server = createServer(createApp({
  store,
  corsOrigin: config.corsOrigin,
  rateLimitMax: config.rateLimitMax,
  rateLimitWindowMs: config.rateLimitWindowMs,
}));

server.listen(config.port, config.host, () => {
  console.log(`Halloween Flappy Bird API listening on http://${config.host}:${config.port}`);
});

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
