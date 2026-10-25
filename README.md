# Halloween Flappy Bird backend

A small, dependency-free Node.js API for saving game scores and serving a leaderboard.

## Run locally

Node.js 20 or newer is required.

```sh
cp .env.example .env
npm start
```

Node does not load `.env` automatically. Export the settings you want to override, or use Node's built-in env-file support:

```sh
node --env-file=.env src/server.js
```

The API listens on `http://localhost:3000` by default and saves scores to `data/scores.json`.

## API

- `GET /api/health` returns service status and the number of saved scores.
- `GET /api/scores?limit=10` returns the ranked leaderboard. The limit is clamped to 1–100.
- `POST /api/scores` accepts `{ "playerName": "Pumpkin", "score": 13 }`.
- `GET /api/players/:playerName/best` returns a player's best score, matched case-insensitively.

Example score submission:

```sh
curl -X POST http://localhost:3000/api/scores \
  -H 'content-type: application/json' \
  -d '{"playerName":"Pumpkin","score":13}'
```

## Configuration

Copy `.env.example` for the available settings. For production, set `CORS_ORIGIN` to the frontend's origin. The in-memory rate limiter is intended for a single server process; use a shared limiter when scaling to multiple instances.

## Test

```sh
npm test
```
