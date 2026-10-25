function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getConfig(env = process.env) {
  return {
    host: env.HOST || "0.0.0.0",
    port: positiveInteger(env.PORT, 3000),
    dataFile: env.DATA_FILE || "./data/scores.json",
    corsOrigin: env.CORS_ORIGIN || "*",
    rateLimitMax: positiveInteger(env.RATE_LIMIT_MAX, 120),
    rateLimitWindowMs: positiveInteger(env.RATE_LIMIT_WINDOW_MS, 60_000),
  };
}
