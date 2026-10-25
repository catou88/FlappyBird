const MAX_BODY_BYTES = 10_000;

function sendJson(response, status, data, corsOrigin) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    "access-control-allow-origin": corsOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.status = 400;
    throw error;
  }
}

function validateScore(body) {
  const playerName = typeof body.playerName === "string" ? body.playerName.trim() : "";
  if (playerName.length < 1 || playerName.length > 24) {
    return { error: "playerName must be between 1 and 24 characters" };
  }
  if (!Number.isInteger(body.score) || body.score < 0 || body.score > 1_000_000) {
    return { error: "score must be an integer between 0 and 1000000" };
  }
  return { playerName, score: body.score };
}

function createRateLimiter({ max, windowMs }) {
  const clients = new Map();
  return (address) => {
    const now = Date.now();
    const current = clients.get(address);
    if (!current || current.resetAt <= now) {
      clients.set(address, { count: 1, resetAt: now + windowMs });
      return false;
    }
    current.count += 1;
    return current.count > max;
  };
}

export function createApp({ store, corsOrigin = "*", rateLimitMax = 120, rateLimitWindowMs = 60_000 }) {
  const isRateLimited = createRateLimiter({ max: rateLimitMax, windowMs: rateLimitWindowMs });

  return async function app(request, response) {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": corsOrigin,
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      return response.end();
    }

    const address = request.socket.remoteAddress || "unknown";
    if (isRateLimited(address)) {
      return sendJson(response, 429, { error: "Too many requests" }, corsOrigin);
    }

    try {
      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, 200, { status: "ok", scores: store.count() }, corsOrigin);
      }

      if (request.method === "GET" && url.pathname === "/api/scores") {
        const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "10", 10);
        const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 10;
        return sendJson(response, 200, { leaderboard: store.leaderboard(limit) }, corsOrigin);
      }

      if (request.method === "POST" && url.pathname === "/api/scores") {
        const validated = validateScore(await readJson(request));
        if (validated.error) return sendJson(response, 400, { error: validated.error }, corsOrigin);
        const entry = await store.add(validated);
        return sendJson(response, 201, { score: entry }, corsOrigin);
      }

      const playerMatch = url.pathname.match(/^\/api\/players\/([^/]+)\/best$/);
      if (request.method === "GET" && playerMatch) {
        let playerName;
        try {
          playerName = decodeURIComponent(playerMatch[1]);
        } catch {
          return sendJson(response, 400, { error: "Invalid player name" }, corsOrigin);
        }
        const best = store.playerBest(playerName);
        return best
          ? sendJson(response, 200, { score: best }, corsOrigin)
          : sendJson(response, 404, { error: "Player has no scores" }, corsOrigin);
      }

      return sendJson(response, 404, { error: "Route not found" }, corsOrigin);
    } catch (error) {
      console.error(error);
      return sendJson(response, error.status || 500, { error: error.status ? error.message : "Internal server error" }, corsOrigin);
    }
  };
}
