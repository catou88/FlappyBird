# Halloween Flappy Bird

A Halloween-themed Flappy Bird. Fly a bat through a moonlit graveyard and squeeze between stone pillars topped with jack-o'-lanterns. The repository has a browser frontend and a small, dependency-free Node.js API for saving game scores and serving a leaderboard.

## Play (frontend)

Open `index.html` in a browser (or run `python -m http.server` and visit http://localhost:8000).

| Action | Control |
|---|---|
| Flap | Space / Up / W / click / tap |
| Pause | P or Esc |

The game speeds up as you score, and your best score is saved in the browser.

Enter a name on the start screen and your score is sent to the API when the game ends. The Game Over screen then shows the top 5. If the API is not running, the game still works and the leaderboard shows "offline". The frontend looks for the API at `http://localhost:3000`; add `?api=https://your-server` to the page URL to use another one.

To play with the leaderboard, run both:

```sh
npm start                       # API on :3000
python -m http.server 8000      # game on :8000
```

Frontend files:

- `index.html` – page and menus
- `style.css` – menu and layout styling
- `game.js` – game loop, drawing (canvas) and sound (no assets needed)

## Run the API locally

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
