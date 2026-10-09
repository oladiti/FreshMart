// POST /api/ai/chat
//
// The AI shopping assistant endpoint. Orchestrates the agent loop (LLM + tools,
// see services/ai) and, when no LLM is configured or reachable, degrades to the
// rule-based assistant so the store never depends on an external provider.

import { getAiConfig } from "../services/ai/config.js";
import { runAgent } from "../services/ai/agent.js";
import { runFallback } from "../services/ai/fallback.js";
import { checkRateLimit } from "../services/ai/rateLimit.js";
import { AiProviderError } from "../services/ai/client.js";

const MAX_HISTORY_TURNS = 10;

function toHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const { maxMessageLength } = getAiConfig();
  return raw
    .filter(
      (entry) =>
        entry &&
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.content === "string"
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((entry) => ({
      role: entry.role,
      content: entry.content.slice(0, maxMessageLength),
    }));
}

export const aiChat = async (req, res) => {
  try {
    const { maxMessageLength } = getAiConfig();
    const rawMessage = req.body?.message;
    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";

    if (!message) {
      return res.status(400).json({ message: "Please type a message." });
    }
    if (message.length > maxMessageLength) {
      return res
        .status(400)
        .json({ message: `Please keep messages under ${maxMessageLength} characters.` });
    }

    const rateKey = req.user?._id ? `user:${req.user._id}` : `ip:${req.ip}`;
    if (!checkRateLimit(rateKey)) {
      return res
        .status(429)
        .json({ message: "You're sending messages too quickly. Please wait a moment." });
    }

    const history = toHistory(req.body?.history);
    const user = req.user || null;

    // No provider configured: go straight to the rule-based assistant.
    if (!getAiConfig().apiKey) {
      const fallback = await runFallback(message);
      return res.json({
        success: true,
        message: fallback.message,
        data: fallback.data,
        degraded: true,
      });
    }

    try {
      const result = await runAgent({ message, history, user });
      return res.json({
        success: true,
        message: result.message,
        data: result.data,
        degraded: false,
      });
    } catch (error) {
      if (error instanceof AiProviderError) {
        // Provider timeout/network/5xx: answer with the rule-based engine so
        // the conversation still works.
        const fallback = await runFallback(message);
        return res.json({
          success: true,
          message: fallback.message,
          data: fallback.data,
          degraded: true,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("AI chat failed:", error);
    res.status(500).json({ message: "The assistant could not handle that. Please try again." });
  }
};

export default aiChat;