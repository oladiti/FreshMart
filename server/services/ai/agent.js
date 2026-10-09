// The agent loop.
//
// Runs the message through the LLM with the filtered tool surface, executes any
// tool calls the model requests, feeds the grounded results back, and repeats
// until the model answers without a tool call or the iteration budget runs out.
//
// Along the way it collects a structured `data` payload the React client can
// render (product cards, cart, recipes, orders, admin stats) so the UI never
// has to trust the model's prose.

import getAiConfig from "./config.js";
import { createChatCompletion } from "./client.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import { toolDefinitionsFor, runAITool, isProductTool } from "./tools/registry.js";

const dedupeById = (list) => {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item?._id) continue;
    const key = String(item._id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

/**
 * Fold one tool envelope into the response's structured `data`.
 */
function accumulateData(data, envelope) {
  const name = envelope?.tool;
  if (name && isProductTool(name) && Array.isArray(envelope.results)) {
    data.products = dedupeById([...data.products, ...envelope.results]);
  }
  if (Array.isArray(envelope?.recommendations)) {
    // recommendProducts: a {product, reason} list, not bare products, so it
    // rides alongside data.products rather than inside it.
    data.recommendations = envelope.recommendations;
    data.personalized = Boolean(envelope.personalized);
  }
  if (envelope?.cart) data.cart = envelope.cart;
  if (envelope?.basket) data.basket = envelope.basket;
  const hasRecipeList = Array.isArray(envelope?.lines) && typeof envelope?.matchedCount === "number";
  if (hasRecipeList) {
    // Recipe list / ingredient match results are rendered as a recipe block.
    data.recipe = {
      title: envelope.recipe?.title ?? null,
      recipe: envelope.recipe,
      lines: envelope.lines ?? [],
      matchedCount: envelope.matchedCount ?? 0,
      unmatched: envelope.unmatched ?? [],
      total: envelope.total ?? 0,
      note: envelope.note ?? null,
    };
  }
  if (envelope?.recipe && Array.isArray(envelope.recipe.ingredients) && !hasRecipeList) {
    // A single fetched recipe (getRecipe).
    data.recipe = { recipe: envelope.recipe };
  }
  if (Array.isArray(envelope.orders)) {
    data.orders = dedupeById([...data.orders, ...envelope.orders], "_id");
  }
  if (Array.isArray(envelope.history)) {
    data.history = dedupeById([...data.history, ...envelope.history], "_id");
  }
  if (envelope?.order) {
    const list = Array.isArray(data.orders) ? data.orders : [];
    if (!list.some((o) => o._id === envelope.order._id)) list.push(envelope.order);
    data.orders = list;
  }
  if (Array.isArray(envelope.items) && envelope.reason === undefined) {
    // Frequently-purchased items (user insights). Admin `products`/`categories`
    // are placed under data.admin, so this branch is for user-level item lists.
    if (envelope.status !== "not_supported") data.userItems = envelope.items;
  }
  if (envelope?.admin) data.admin = envelope.admin;
  if (envelope?.support && (envelope.support?.topic || envelope.support?.answer || envelope.store)) {
    data.support = envelope.support;
    if (envelope.store) data.store = envelope.store;
  }
  if (envelope?.status === "needs_confirmation") data.needsConfirmation = envelope;
  if (envelope?.status === "auth_required") data.authRequired = true;
  if (envelope?.status === "forbidden") data.forbidden = true;
  if (envelope?.status === "not_supported") data.notSupported = envelope.message ?? true;
}

function parseToolArguments(raw) {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

/**
 * Run one assistant turn.
 *
 * @param {object} params
 * @param {string} params.message the shopper's message
 * @param {Array} [params.history] prior turns [{role, content}] (already validated/capped by the controller)
 * @param {object|null} [params.user] authenticated user or null
 * @returns {Promise<{message: string, data: object, degraded: false}>}
 */
export async function runAgent({ message, history = [], user = null }) {
  const config = getAiConfig();
  const tools = toolDefinitionsFor({ user });
  const isAdmin = Boolean(user?.role === "admin");

  const messages = [
    { role: "system", content: buildSystemPrompt({ isAdmin }) },
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    { role: "user", content: message },
  ];

  const data = {
    products: [],
    recommendations: [],
    personalized: false,
    recipe: null,
    cart: null,
    basket: null,
    orders: [],
    history: [],
    userItems: [],
    admin: null,
    support: null,
    store: null,
    needsConfirmation: null,
  };

  let content = "";
  let sawToolError = false;

  for (let iteration = 0; iteration < config.maxToolIterations; iteration++) {
    const { content: responseContent, toolCalls } = await createChatCompletion({
      messages,
      tools,
    });

    if (responseContent) content = responseContent;

    if (!toolCalls.length) {
      break;
    }

    const assistantTurn = {
      role: "assistant",
      content: responseContent || null,
      tool_calls: toolCalls,
    };
    messages.push(assistantTurn);

    for (const call of toolCalls) {
      const args = parseToolArguments(call.function.arguments);
      const envelope = await runAITool(call.function.name, args, { user });
      if (envelope.status === "tool_error") sawToolError = true;
      accumulateData(data, envelope);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(envelope),
      });
    }
  }

  // If we never got prose back (e.g. a final tool-call-only turn), build a
  // minimal, safe summary rather than returning an empty message.
  if (!content) {
    content = sawToolError
      ? "Sorry - one of my lookups hiccupped. Could you ask me again?"
      : "Here's what I found for you. Anything else I can help with?";
  }

  return { message: content.trim(), data, degraded: false };
}

export default runAgent;