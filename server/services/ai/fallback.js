// Degraded-mode fallback for the AI chat endpoint.
//
// When the LLM provider is not configured or unreachable, /api/ai/chat still
// answers using the existing, fully-tested rule-based assistant
// (assistantController). The store keeps working with zero AI dependencies.
//
// This adapter invokes queryAssistant() with a lightweight fake response object
// so all of its parsing/product/recipe/budget logic is reused verbatim.

import { queryAssistant } from "../../controllers/assistantController.js";

function makeJsonResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body ?? {};
      return this;
    },
    send(body) {
      this.body = body ?? {};
      return this;
    },
  };
}

/** The safe fallback prompt list shown in degraded mode. */
export const FALLBACK_SUGGESTIONS = [
  "Show me rice",
  "Find cheap cooking oil",
  "What can I buy with £15?",
  "Ingredients for jollof rice",
];

/**
 * @param {string} message the (already-trimmed, validated) shopper message
 * @returns {Promise<{success: boolean, message: string, data: object, degraded: true}>}
 */
export async function runFallback(message) {
  const res = makeJsonResponse();
  await queryAssistant({ body: { query: message } }, res);

  if (res.statusCode >= 400 || !res.body || !res.body.success) {
    return {
      success: true,
      message: res.body?.message || "I couldn't find an answer for that just now. Please try again.",
      data: {},
      degraded: true,
    };
  }

  const body = res.body;
  return {
    success: true,
    message: body.reply || "Here's what I found.",
    data: {
      products: Array.isArray(body.products) ? body.products : [],
      recipe: body.recipe ?? null,
      basket: body.basket ?? null,
      clarifyingQuestion: body.clarifyingQuestion ?? null,
      suggested: Array.isArray(body.suggestions) ? body.suggestions : FALLBACK_SUGGESTIONS,
    },
    degraded: true,
  };
}

export default runFallback;