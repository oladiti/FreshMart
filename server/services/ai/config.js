// Runtime configuration for the AI assistant service.
//
// Reads process.env at call time (not import time) so tests can toggle values
// without re-importing modules. Every value is validated and coerced; a bad
// numeric env var falls back to its default rather than crashing the server.

const DEFAULTS = {
  apiKey: "",
  model: "gemini-3.8-flash",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  maxTokens: 700,
  timeoutMs: 25000,
  maxMessageLength: 2000,
  maxToolIterations: 6,
  rateLimitPerMin: 30,
};

const toPositiveInt = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
};

export function getAiConfig() {
  const config = {
    apiKey: String(process.env.AI_API_KEY || "").trim(),
    model:
      String(process.env.AI_MODEL || "").trim() || DEFAULTS.model,
    baseUrl:
      String(process.env.AI_BASE_URL || "").trim().replace(/\/+$/, "") ||
      DEFAULTS.baseUrl,
    maxTokens: toPositiveInt(process.env.AI_MAX_TOKENS, DEFAULTS.maxTokens),
    timeoutMs: toPositiveInt(process.env.AI_TIMEOUT_MS, DEFAULTS.timeoutMs),
    maxMessageLength: toPositiveInt(
      process.env.AI_MAX_MESSAGE_LENGTH,
      DEFAULTS.maxMessageLength
    ),
    maxToolIterations: toPositiveInt(
      process.env.AI_MAX_TOOL_ITERATIONS,
      DEFAULTS.maxToolIterations
    ),
    rateLimitPerMin: toPositiveInt(
      process.env.AI_RATE_LIMIT_PER_MIN,
      DEFAULTS.rateLimitPerMin
    ),
  };

  // Iterations must stay bounded regardless of config.
  config.maxToolIterations = Math.min(Math.max(config.maxToolIterations, 1), 10);
  return config;
}

/** Whether the LLM provider is reachable at all (i.e. an API key is set). */
export function isAiConfigured() {
  return Boolean(getAiConfig().apiKey);
}

export default getAiConfig;