// The assistant's tool surface.
//
// The rule-based assistant (assistantController) works through this small
// registry: one entry per tool, looked up by name. The LLM agent in
// services/ai owns a much larger registry of its own; this one stays
// deliberately tiny because everything here is reachable from a plain HTTP
// query with no model in the loop.
//
// runTool never throws: every failure - unknown name, refused arguments, a
// crash inside the runner - comes back as an envelope the caller can render.

import {
  searchProducts,
  validateSearchArgs,
  SEARCH_PRODUCTS_TOOL,
  TOOL_NAME,
  AVAILABILITY,
  SORT,
} from "./searchProducts.js";
import { getProductById } from "./getProductById.js";
import { findRelatedProducts } from "./findRelatedProducts.js";
import { findCheaperAlternative } from "./findCheaperAlternative.js";
import { checkProductStock } from "./checkProductStock.js";
import { groundProduct, verifyGroundedProducts, assertGrounded, GROUNDED_FIELDS } from "./grounding.js";

export {
  searchProducts,
  validateSearchArgs,
  SEARCH_PRODUCTS_TOOL,
  TOOL_NAME,
  AVAILABILITY,
  SORT,
  getProductById,
  findRelatedProducts,
  findCheaperAlternative,
  checkProductStock,
  groundProduct,
  verifyGroundedProducts,
  assertGrounded,
  GROUNDED_FIELDS,
};

/** Every tool the rule-based assistant can call, by name. */
export const ASSISTANT_TOOLS = Object.freeze([SEARCH_PRODUCTS_TOOL]);

/** The tool definitions for the assistant surface. */
export function listToolDefinitions() {
  return ASSISTANT_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/** @returns {object|null} the definition of one tool, or null if it is unknown. */
export function getToolDefinition(name) {
  return ASSISTANT_TOOLS.find((tool) => tool.name === name) ?? null;
}

/**
 * Run a tool by name.
 *
 * @param {string} name
 * @param {object} args raw argument bag
 * @returns {Promise<object>} an envelope; never rejects for bad input
 */
export async function runTool(name, args) {
  const tool = getToolDefinition(name);
  if (!tool) {
    return {
      ok: false,
      status: "unknown_tool",
      errors: [{ field: "(root)", message: `Unknown tool "${name}".` }],
      results: [],
    };
  }

  try {
    const payload = await tool.runner(args);
    return { ok: payload?.ok !== false, status: payload?.status ?? "ok", ...payload };
  } catch (error) {
    console.error(`❌ Assistant tool "${name}" failed:`, error);
    return {
      ok: false,
      status: "tool_error",
      errors: [{ field: "(root)", message: "That lookup failed. Please try again." }],
      results: [],
    };
  }
}
