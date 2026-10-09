// OpenAI-compatible chat completions client.
//
// The assistant deliberately has no AI SDK dependency: the server stack is
// Express + Mongoose, and a plain fetch call keeps the surface small and works
// with any OpenAI-compatible provider (OpenAI, Azure, local models...).
//
// All failures are typed so the caller can decide between a retry and a
// graceful fallback to the rule-based assistant.

import getAiConfig from "./config.js";

export class AiProviderError extends Error {
  constructor(message, { status = null, code = "AI_PROVIDER_ERROR", retryable = false } = {}) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Call the provider's /chat/completions endpoint.
 *
 * @param {object} params
 * @param {Array} params.messages [{role, content, ...}] OpenAI message objects
 * @param {Array} [params.tools] OpenAI function tool definitions
 * @param {number} [params.temperature]
 * @returns {Promise<{content: string, toolCalls: Array, finishReason: string|null}>}
 * @throws {AiProviderError} on any provider/network failure
 */
export async function createChatCompletion({ messages, tools, temperature = 0.2 }) {
  const config = getAiConfig();

  if (!config.apiKey) {
    throw new AiProviderError("AI provider is not configured", {
      code: "AI_NOT_CONFIGURED",
    });
  }

  const body = {
    model: config.model,
    messages,
    temperature,
    max_tokens: config.maxTokens,
  };
  if (Array.isArray(tools) && tools.length) {
    body.tools = tools;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(
      `${config.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new AiProviderError(
        `AI provider responded ${response.status}: ${text.slice(0, 300)}`,
        {
          status: response.status,
          code: "AI_PROVIDER_ERROR",
          retryable: response.status >= 500 || response.status === 429,
        }
      );
    }

    const json = await response.json();
    const choice = json?.choices?.[0];
    if (!choice) {
      throw new AiProviderError("AI provider returned no completions", {
        code: "AI_EMPTY_RESPONSE",
      });
    }

    const choiceMessage = choice.message || {};
    return {
      content:
        typeof choiceMessage.content === "string" ? choiceMessage.content : "",
      toolCalls: Array.isArray(choiceMessage.tool_calls)
        ? choiceMessage.tool_calls.filter(
            (call) => call?.type === "function" && call?.function?.name
          )
        : [],
      finishReason: choice.finish_reason ?? null,
    };
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    if (error?.name === "AbortError") {
      throw new AiProviderError("AI provider request timed out", {
        code: "AI_TIMEOUT",
        retryable: true,
      });
    }
    const wrapped = new AiProviderError(
      `AI provider unavailable: ${error?.message || "unknown error"}`,
      { code: "AI_NETWORK", retryable: true }
    );
    wrapped.cause = error;
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
}

export default createChatCompletion;