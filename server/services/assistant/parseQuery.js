// The rule-based query parser behind the assistant.
//
// parseQuery() turns one shopper message into an intent plus a slot bag that
// the controller can hand straight to the searchProducts tool (keyword,
// category, price bounds, sort, stock). It is pure string work - no database,
// no model, no network - and it never throws: anything it cannot read comes
// back as INTENTS.UNCLEAR with an empty slot bag, which the controller answers
// with a clarifying question.
//
// Two rules shape the output:
//
//   1. Slots are typed exactly as the controller reads them: `categories` is
//      always an array, prices are `number | null` (never undefined, because
//      the controller branches on `!== null`), and `sort` is always a value the
//      searchProducts tool accepts.
//   2. Money is only read when a currency marker is present, so "for 6 people"
//      is never mistaken for a price and "5kg rice" keeps its size.

export const INTENTS = Object.freeze({
  PRODUCT_SEARCH: "product_search",
  VALUE_FIND: "value_find",
  BUDGET_BASKET: "budget_basket",
  RECIPE_INGREDIENTS: "recipe_ingredients",
  AVAILABILITY: "availability",
  BUNDLE: "bundle",
  UNCLEAR: "unclear",
});

/** The only sorts this parser emits (a subset of the tool's SORT enum). */
const SORT = Object.freeze({
  RELEVANCE: "relevance",
  PRICE_ASC: "price_asc",
  PRICE_DESC: "price_desc",
});

/**
 * Mirrors the alias table in services/assistant/tools/searchProducts.js (that
 * one is module-private). Duplicating it here is safe rather than risky: the
 * tool re-verifies every category against the real distinct list before it
 * filters, so a name that ever went stale here can only be reported back as
 * "unverified" - it can never widen a query or invent an aisle.
 */
const CATEGORY_ALIASES = Object.freeze({
  veg: "Vegetables",
  veggie: "Vegetables",
  veggies: "Vegetables",
  vegetable: "Vegetables",
  vegetables: "Vegetables",
  greens: "Vegetables",
  fruit: "Fruits",
  fruits: "Fruits",
  milk: "Dairy",
  dairy: "Dairy",
  chicken: "Poultry",
  poultry: "Poultry",
  beef: "Meat",
  pork: "Meat",
  lamb: "Meat",
  meat: "Meat",
  seafood: "Fish",
  fish: "Fish",
  snack: "Snacks",
  snacks: "Snacks",
  crisps: "Snacks",
  chips: "Snacks",
  drink: "Beverages",
  drinks: "Beverages",
  beverages: "Beverages",
  oil: "Cooking Oil",
  oils: "Cooking Oil",
  "cooking oil": "Cooking Oil",
  spice: "Spices",
  spices: "Spices",
  herbs: "Spices",
  bread: "Bakery",
  bakery: "Bakery",
  grocery: "Pantry",
  groceries: "Pantry",
  pantry: "Pantry",
  staples: "Pantry",
  household: "Household",
  cleaning: "Household",
  dessert: "Dessert",
  sweets: "Dessert",
  soup: "Soup",
  soups: "Soup",
});

/**
 * Words that describe the *ask*, never the product. They are stripped from the
 * keyword so "show me the cheap tinned tomatoes" searches for "tinned
 * tomatoes", not for a product literally called "cheap".
 */
const STOPWORDS = new Set([
  // articles, prepositions, conjunctions, qualifiers
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "from", "by",
  "as", "and", "or", "but", "over", "under", "above", "below", "between",
  "than", "too", "very", "just", "about", "around", "within", "up", "down",
  // pronouns and auxiliaries
  "i", "me", "my", "mine", "we", "our", "ours", "you", "your", "yours", "it",
  "its", "this", "that", "these", "those", "is", "are", "was", "were", "be",
  "been", "am", "do", "does", "did", "have", "has", "had", "will", "would",
  "can", "could", "should", "shall", "may", "might", "must", "not",
  // question words
  "what", "whats", "which", "who", "whom", "where", "when", "why", "how",
  // shopping verbs and politeness
  "show", "find", "search", "look", "looking", "get", "give", "fetch",
  "want", "like", "need", "buy", "purchase", "order", "tell", "let", "see",
  "view", "browse", "check", "please", "thanks", "thank", "hi", "hello",
  "hey", "make", "making", "cook", "prepare", "preparing", "bake", "baking",
  // filler nouns
  "product", "products", "item", "items", "thing", "things", "stuff",
  "something", "anything", "some", "any", "one", "ones", "many", "much",
  "more", "most", "several", "else", "now", "today", "currently",
  "week", "weeks",
  "out", "sold", "left", "still",
  // intent words: price talk, stock talk, recipe talk, occasion talk
  "cheap", "cheapest", "cheaper", "expensive", "dearest", "highest",
  "lowest", "priciest", "price", "prices", "offer", "offers", "deal",
  "deals", "discount", "discounts", "reduced", "bargain", "bargains",
  "budget", "budgets", "afford", "affordable", "spend", "spending",
  "stock", "stocks", "available", "availability", "recipe", "recipes",
  "ingredient", "ingredients", "bundle", "bundles", "people", "persons",
  "guests", "friends", "relevance",
]);

const MAX_KEYWORD_LENGTH = 120;
const MAX_CATEGORIES = 10;
const MAX_QUANTITY = 999;

/**
 * Split a message into lowercase alphanumeric words.
 *
 * Punctuation never survives, so "rice." and "rice" are the same token - the
 * controller's recipe matcher relies on that when it compares dish words
 * against recipe titles.
 *
 * @param {unknown} text
 * @returns {string[]}
 */
export function tokenize(text) {
  const source = typeof text === "string" ? text : text == null ? "" : String(text);
  return source.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Read the first number out of a currency span such as "£12.50". */
function amountOf(span) {
  const found = String(span).match(/\d+(?:[.,]\d{1,2})?/);
  if (!found) return null;
  const value = Number(found[0].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** "party" -> "a party", "event" -> "an event", "6 people" -> "6 people". */
function article(word) {
  return /^[aeiou]/.test(word) ? "an" : "a";
}

const singular = (word) => {
  const value = String(word).toLowerCase();
  if (value.length > 4 && value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.length > 4 && value.endsWith("es")) return value.slice(0, -2);
  if (value.length > 3 && value.endsWith("s")) return value.slice(0, -1);
  return value;
};

/** Currency spans, with their own index so pairs can be matched up later. */
const MONEY_RE = () =>
  /(?:£|\$|€)\s*\d+(?:[.,]\d{1,2})?|\b\d+(?:[.,]\d{1,2})?\s*(?:pounds?|quid|gbp)\b/gi;

/** A qualifier sitting immediately before a price ("under ", "budget "). */
const TRAILING_QUALIFIER =
  /\b(?:between|from|under|below|less\s+than|more\s+than|up\s+to|at\s+most|at\s+least|over|above|within|max(?:imum)?|min(?:imum)?|starting\s+(?:at|from)|no\s+more\s+than|no\s+less\s+than|cheaper\s+than|budget\w*|afford\w*|spend\w*|allowance|basket|trolley|can\s+i\s+buy|what\s+can\s+i|with|for)\s*$/i;

const BUDGET_CONTEXT =
  /\b(?:budget\w*|afford\w*|spend\w*|allowance|basket|trolley|can\s+i\s+buy|what\s+can\s+i)\b/;

const FLOOR_CONTEXT =
  /\b(?:over|above|more\s+than|at\s+least|from|minimum|min(?:imum)?|starting\s+(?:at|from)|no\s+less\s+than)\s*$/i;

/**
 * Pull every price out of a message and return the text with them removed.
 *
 * A span only counts as money when it carries a currency marker, and the words
 * around it decide which slot it lands in: "budget of £20" is a budget, "under
 * £10" is a ceiling, "from £5" is a floor, and "between £5 and £10" is both.
 *
 * @param {string} text
 * @returns {{minPrice: number|null, maxPrice: number|null, budget: number|null, work: string}}
 */
function extractPrices(text) {
  const state = { minPrice: null, maxPrice: null, budget: null };
  const ranges = [];
  const spans = [];

  const moneyRe = MONEY_RE();
  let match;
  while ((match = moneyRe.exec(text)) !== null) {
    const value = amountOf(match[0]);
    if (value !== null) {
      spans.push({ start: match.index, end: match.index + match[0].length, value });
    }
  }

  const used = new Set();
  const setOnce = (key, value) => {
    if (state[key] === null) state[key] = value;
  };

  for (let index = 0; index < spans.length; index += 1) {
    if (used.has(index)) continue;

    const span = spans[index];
    const beforeStart = Math.max(0, span.start - 60);
    const before = text.slice(beforeStart, span.start);
    const beforeLower = before.toLowerCase();
    const afterLower = text.slice(span.end, span.end + 30).toLowerCase();

    // "between £5 and £10" / "from £5 to £10" - one range covering both spans.
    const pairWord = beforeLower.match(/\b(between|from)\s*$/);
    if (pairWord && index + 1 < spans.length && !used.has(index + 1)) {
      const next = spans[index + 1];
      if (/^\s*(?:and|to|-|–|—)\s*$/.test(text.slice(span.end, next.start))) {
        setOnce("minPrice", Math.min(span.value, next.value));
        setOnce("maxPrice", Math.max(span.value, next.value));
        const wordAt = beforeLower.lastIndexOf(pairWord[1]);
        ranges.push([beforeStart + wordAt, next.end]);
        used.add(index);
        used.add(index + 1);
        continue;
      }
    }

    const budgetish =
      BUDGET_CONTEXT.test(beforeLower) || BUDGET_CONTEXT.test(afterLower);
    const key = budgetish
      ? "budget"
      : FLOOR_CONTEXT.test(beforeLower)
        ? "minPrice"
        : "maxPrice";

    const qualifier = beforeLower.match(TRAILING_QUALIFIER);
    ranges.push([qualifier ? span.start - qualifier[0].length : span.start, span.end]);
    setOnce(key, span.value);
    used.add(index);
  }

  let work = text;
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) {
    work = `${work.slice(0, start)} ${work.slice(end)}`;
  }

  return { ...state, work };
}

/** Words the shopper uses to say *how* they want to shop, not *what*. */
const AVAILABILITY_RE =
  /\b(?:in\s+stock|in\s+store|on\s+the\s+shelf|left\s+in\s+stock|available|availability|stock|stocked)\b/;

const SOLD_OUT_RE = /\b(?:sold\s+out|out\s+of\s+stock|not\s+in\s+stock|unavailable)\b/;

const BUDGET_RE =
  /\b(?:budget\w*|afford\w*|spend\w*|allowance|basket|trolley|how\s+much\s+can\s+i|what\s+can\s+i)\b/;

const RECIPE_RE =
  /\b(?:ingredients?|recipes?)\b|\bwhat\s+do\s+i\s+need\b|\bhow\s+(?:do|can)\s+i\s+(?:make|cook|bake)\b|\bto\s+make\b|\bi\s+(?:want|need)\s+to\s+(?:make|cook|bake)\b|\b(?:make|cook|bake|prepare)\s+(?:a|an|the)\b/;

const CHEAP_RE =
  /\b(?:cheap|cheapest|cheaper|lowest|lowest\s+price|best\s+price|on\s+offer|offers?|deals?|discounts?|reduced|bargain\w*|price\s+drop)\b/;

const EXPENSIVE_RE =
  /\b(?:most\s+expensive|highest\s+price|dearest|price\s+high\s+to\s+low)\b/;

const EVENT_RE =
  /\b(parties|party|gatherings|gathering|get[\s-]togethers?|events?|barbecues?|barbeques?|bbq|picnics?|feasts?|celebrations?|weddings?|birthdays?|hosting|banquets?|crowds?)\b/i;

const PEOPLE_RE = /\bfor\s+(\d{1,3})\s*(?:people|persons|guests|friends)\b/;

const QUANTITY_RE =
  /\b(\d{1,3})\s+(bags?|packs?|packets?|pieces?|units?|kgs?|kilos?|kilograms?|grams?|ltrs?|litres?|liters?|cans?|tins?|boxes?|bottles?|loaves?|cartons?|tubs?|punnets?|portions?|slices?|dozen)\s*(?:of)?\b/i;

const BUNDLE_RE = /\b(?:bundles?)\b/;

const CUE_RE =
  /\b(?:show|find|search|look|looking|i\s+want|get|give|which|what|where|how|need|buy)\b/;

function emptySlots() {
  return {
    query: "",
    categories: [],
    occasion: null,
    minPrice: null,
    maxPrice: null,
    budget: null,
    quantity: null,
    inStock: false,
    sort: SORT.RELEVANCE,
    recipeQuery: null,
  };
}

/** Aisle names the shopper said out loud, resolved to the catalogue's own. */
function extractCategories(work) {
  const found = [];
  const lower = work.toLowerCase();

  for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES)) {
    if (!alias.includes(" ")) continue;
    const phrase = new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (phrase.test(lower) && !found.includes(canonical)) found.push(canonical);
    if (found.length >= MAX_CATEGORIES) return found;
  }

  for (const token of tokenize(lower)) {
    const canonical = CATEGORY_ALIASES[token];
    if (canonical && !found.includes(canonical)) found.push(canonical);
    if (found.length >= MAX_CATEGORIES) break;
  }

  return found;
}

/** The keyword, capped at what the searchProducts tool will accept. */
function buildQuery(work) {
  const words = tokenize(work).filter(
    // A bare number is a quantity or a price, never a product name; sizes like
    // "5kg" survive because they mix digits and letters.
    (word) => word.length > 1 && !STOPWORDS.has(word) && !/^\d+$/.test(word)
  );

  let query = "";
  for (const word of words) {
    const next = query ? `${query} ${word}` : word;
    if (next.length > MAX_KEYWORD_LENGTH) break;
    query = next;
  }
  return query;
}

function confidenceFor(intent, slots, hasCue) {
  if (intent === INTENTS.UNCLEAR) return hasCue ? 0.35 : 0.2;

  let value = intent === INTENTS.PRODUCT_SEARCH ? 0.55 : 0.75;
  if (slots.query) value += 0.15;
  if (slots.categories.length) value += 0.05;
  if (slots.minPrice !== null || slots.maxPrice !== null || slots.budget !== null) {
    value += 0.05;
  }
  if (hasCue) value += 0.05;
  return Math.min(0.98, value);
}

/**
 * Parse one shopper message into an intent and its slots.
 *
 * Never throws and never returns undefined slots: an empty or unreadable
 * message comes back as INTENTS.UNCLEAR so the controller can ask a question
 * instead of failing.
 *
 * @param {unknown} text the raw message
 * @returns {{intent: string, slots: object, confidence: number}}
 */
export function parseQuery(text) {
  const raw = typeof text === "string" ? text : text == null ? "" : String(text);
  const slots = emptySlots();

  const priced = extractPrices(raw);
  slots.minPrice = priced.minPrice;
  slots.maxPrice = priced.maxPrice;
  slots.budget = priced.budget;
  let work = priced.work;

  const quantity = work.match(QUANTITY_RE);
  if (quantity) {
    const amount = Number(quantity[1]);
    if (amount > 0 && amount <= MAX_QUANTITY) slots.quantity = amount;
    work = work.replace(QUANTITY_RE, " ");
  }

  const people = work.match(PEOPLE_RE);
  const peoplePart = people ? `for ${people[1]} people` : null;
  if (people) work = work.replace(PEOPLE_RE, " ");

  // An event word only becomes an occasion when it is not modifying a product
  // ("birthday cake" is a search, "snacks for a party" is an occasion), so the
  // word directly after it decides which of the two the shopper meant.
  const occasionWords = work.match(EVENT_RE);
  let eventPart = null;
  if (occasionWords) {
    const after = work.slice(occasionWords.index + occasionWords[0].length);
    const next = tokenize(after)[0];
    if (!next || STOPWORDS.has(next)) {
      const noun = singular(occasionWords[1]);
      eventPart = `${article(noun)} ${noun}`;
      work = work.replace(EVENT_RE, " ");
    }
  }

  const src = work.toLowerCase();
  const isAvailability = AVAILABILITY_RE.test(src);
  const isSoldOut = SOLD_OUT_RE.test(src);
  const isBudget = BUDGET_RE.test(src) || slots.budget !== null;
  const isBundle = Boolean(eventPart || peoplePart || BUNDLE_RE.test(src));
  const isRecipe = RECIPE_RE.test(src);
  const isCheap = CHEAP_RE.test(src);
  const isExpensive = EXPENSIVE_RE.test(src);

  if (eventPart || peoplePart) {
    slots.occasion = [eventPart, peoplePart].filter(Boolean).join(" ");
  } else if (BUNDLE_RE.test(src)) {
    slots.occasion = "your event";
  }

  slots.inStock = isAvailability && !isSoldOut;
  slots.categories = extractCategories(work);
  slots.query = buildQuery(work);

  if (isCheap) slots.sort = SORT.PRICE_ASC;
  else if (isExpensive) slots.sort = SORT.PRICE_DESC;

  const hasTarget =
    Boolean(slots.query) ||
    slots.categories.length > 0 ||
    slots.minPrice !== null ||
    slots.maxPrice !== null ||
    slots.budget !== null ||
    slots.occasion !== null;

  let intent;
  if (isAvailability || isSoldOut) {
    intent = INTENTS.AVAILABILITY;
  } else if (isBudget) {
    intent = INTENTS.BUDGET_BASKET;
  } else if (isBundle) {
    intent = INTENTS.BUNDLE;
  } else if (isRecipe) {
    intent = INTENTS.RECIPE_INGREDIENTS;
    slots.recipeQuery = slots.query;
  } else if (isCheap || isExpensive) {
    intent = INTENTS.VALUE_FIND;
  } else if (hasTarget) {
    intent = INTENTS.PRODUCT_SEARCH;
  } else {
    intent = INTENTS.UNCLEAR;
  }

  const confidence = confidenceFor(intent, slots, CUE_RE.test(raw.toLowerCase()));
  return { intent, slots, confidence };
}

export default parseQuery;
