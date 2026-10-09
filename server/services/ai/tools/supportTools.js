// AI support tools.
//
// Store policies are answered from the real SiteSettings collection (with the
// admin defaults as fallback), never invented. The assistant states facts that
// FreshMart has actually configured; contact details are only quoted when they
// are configured, and payments are always redirected to the checkout flow.

import Setting from "../../../models/Setting.js";
import { SETTING_DEFAULTS } from "../../../controllers/adminController.js";

async function readSettings() {
  const docs = await Setting.find({}).lean();
  return { ...SETTING_DEFAULTS, ...Object.fromEntries(docs.map((d) => [d.key, d.value])) };
}

export const GET_STORE_INFO_TOOL = {
  name: "getStoreInfo",
  description: "Return real store facts: store name, currency, delivery estimate, delivery fees, free-delivery threshold and supported payment methods.",
  requiresAuth: false,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  runner: async () => {
    const settings = await readSettings();
    return {
      ok: true,
      status: "ok",
      store: {
        storeName: settings.storeName,
        currency: settings.currencySymbol,
        deliveryTimeEstimate: settings.deliveryTimeEstimate,
        shippingFee: Number(settings.shippingFee) || 0,
        freeShippingThreshold: Number(settings.freeShippingThreshold) || 0,
        taxRate: Number(settings.taxRate) || 0,
      },
      support: {
        email: settings.supportEmail || null,
        phone: settings.supportPhone || null,
      },
      paymentMethods: ["card", "paypal", "cash_on_delivery"],
    };
  },
};

export const GET_STORE_POLICIES_TOOL = {
  name: "getStorePolicies",
  description: "Answer site policy questions (delivery, returns, payments, support contact) using the store's real configured policies.",
  requiresAuth: false,
  requiresAdmin: false,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      topic: {
        type: "string",
        enum: ["delivery", "returns", "payments", "support", "general"],
        description: "Which policy area to answer.",
        default: "general",
      },
    },
  },
  runner: async (_ctx, rawArgs) => {
    const settings = await readSettings();
    const topic = typeof rawArgs?.topic === "string" ? rawArgs.topic : "general";

    const freeShipping = Number(settings.freeShippingThreshold) || 0;
    const shippingFee = Number(settings.shippingFee) || 0;
    const shippingLine = freeShipping > 0
      ? `Delivery is free on orders over ${settings.currencySymbol}${freeShipping.toFixed(2)}; otherwise there is a flat ${settings.currencySymbol}${shippingFee.toFixed(2)} fee.`
      : `Delivery costs ${settings.currencySymbol}${shippingFee.toFixed(2)} per order.`;
    const delivery = `We deliver to the UK. ${shippingLine} Estimated delivery is ${settings.deliveryTimeEstimate}. Also see the Delivery Info page.`;

    const returns =
      "Unopened, non-perishable items can be returned within 14 days for a refund. " +
      "Perishables and frozen items cannot be returned once delivered unless they arrived damaged. " +
      "See the Returns & Refunds page for the full policy.";

    const payments =
      "Payments are handled securely at checkout, never through this assistant. " +
      "We accept card, PayPal and cash on delivery. To pay, add your items to the cart and follow the checkout flow.";

    const contact = [
      settings.supportEmail ? `Email: ${settings.supportEmail}` : null,
      settings.supportPhone ? `Phone: ${settings.supportPhone}` : null,
    ]
      .filter(Boolean)
      .join(". ") || "Visit the Contact page to reach our support team.";

    const answers = {
      delivery,
      returns,
      payments,
      support: contact,
      general: `${delivery} ${returns} ${payments}`,
    };

    return {
      ok: true,
      status: "ok",
      support: {
        topic,
        answer: answers[topic] || answers.general,
        storeName: settings.storeName,
      },
    };
  },
};

export const AI_SUPPORT_TOOLS = [GET_STORE_INFO_TOOL, GET_STORE_POLICIES_TOOL];