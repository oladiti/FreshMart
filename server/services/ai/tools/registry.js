// AI tool registry.
//
// One list of every tool the assistant may call. Two gates apply to every
// invocation:
//   1. The tool surface presented to the model is filtered: requiring-auth
//      tools are omitted for anonymous visitors and admin tools for non-admins,
//      so the model generally cannot even "know" about them.
//   2. Execution re-checks those gates server-side regardless of what the model
//      does, so a cleverly-crafted tool call from a non-admin still fails.
//
// Runners return a plain payload; the registry wraps it in a stable envelope
// (tool name, ok, status, ...payload) that the agent feeds back to the model.

import { AI_PRODUCT_TOOLS, PRODUCT_TOOL_NAMES } from "./productTools.js";
import { AI_CART_TOOLS } from "./cartTools.js";
import { AI_RECIPE_TOOLS } from "./recipeTools.js";
import { AI_SHOPPING_TOOLS } from "./shoppingTools.js";
import { AI_ORDER_TOOLS } from "./orderTools.js";
import { AI_SUPPORT_TOOLS } from "./supportTools.js";
import { AI_USER_TOOLS } from "./userTools.js";
import { AI_ADMIN_TOOLS } from "./adminTools.js";
import { AI_RECOMMEND_TOOLS } from "./recommendTools.js";

export const AI_TOOLS = [
  ...AI_PRODUCT_TOOLS,
  ...AI_RECIPE_TOOLS,
  ...AI_SHOPPING_TOOLS,
  ...AI_SUPPORT_TOOLS,
  ...AI_CART_TOOLS,
  ...AI_ORDER_TOOLS,
  ...AI_USER_TOOLS,
  ...AI_RECOMMEND_TOOLS,
  ...AI_ADMIN_TOOLS,
];

const isAdmin = (user) => user?.role === "admin";

/** The tools a given user is allowed to call (filters requiringAuth/Admin). */
export function listToolsFor({ user } = {}) {
  return AI_TOOLS.filter(
    (tool) =>
      (!tool.requiresAuth || Boolean(user?._id)) &&
      (!tool.requiresAdmin || isAdmin(user))
  );
}

/** OpenAI function-tool definitions for the provider request. */
export function toolDefinitionsFor({ user } = {}) {
  return listToolsFor({ user }).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function isProductTool(name) {
  return PRODUCT_TOOL_NAMES.has(name);
}

/**
 * Execute one tool by name with the caller context.
 *
 * @param {string} name tool name
 * @param {object} args raw arguments from the model (already JSON-parsed)
 * @param {{user?: object}} ctx auth context from the request
 * @returns {Promise<object>} the wrapped envelope described above
 */
export async function runAITool(name, args, ctx = {}) {
  const tool = AI_TOOLS.find((entry) => entry.name === name);

  if (!tool) {
    return {
      tool: name,
      ok: false,
      status: "unknown_tool",
      errors: [{ field: "(root)", message: "That tool does not exist. Use only the tools you were given." }],
    };
  }

  if (tool.requiresAuth && !ctx.user?._id) {
    return {
      tool: name,
      ok: false,
      status: "auth_required",
      errors: [{ field: "(root)", message: "You must be signed in for that. Ask the shopper to log in first." }],
    };
  }

  if (tool.requiresAdmin && !isAdmin(ctx.user)) {
    return {
      tool: name,
      ok: false,
      status: "forbidden",
      errors: [{ field: "(root)", message: "That capability is for shop administrators only." }],
    };
  }

  try {
    const payload = await tool.runner(ctx, args && typeof args === "object" && !Array.isArray(args) ? args : {});
    const wrapped = {
      tool: name,
      ok: payload.ok !== false,
      status: payload.status ?? "ok",
    };
    for (const key of Object.keys(payload)) {
      if (key === "ok" || key === "status") continue;
      wrapped[key] = payload[key];
    }
    return wrapped;
  } catch (error) {
    // A runner crashed: never leak internals to the model, just tell it to
    // recover gracefully.
    return {
      tool: name,
      ok: false,
      status: "tool_error",
      errors: [
        { field: "(root)", message: "The tool failed to run. Do not guess the answer; ask the shopper to try again in a moment." },
      ],
    };
  }
}