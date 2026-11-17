/**
 * Settings for the AI chat. Read on every call (not once at boot) so they can be flipped in tests and, on the host, take effect on the next deploy.
 *
 * The chat needs three things to be on: CHATBOT_ENABLED=true (the owner's switch, off in render.yaml), a provider that can answer, and a signed-in
 * woman. Her health text goes to the AI provider only when she writes it, and a summary of her own numbers only when she has agreed to share it.
 */
const num = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export const chatEnabled = () => process.env.CHATBOT_ENABLED === "true";

/** "scripted" gives fixed, free answers for tests and for trying the screen; it is refused in production. */
export const chatProvider = (): "anthropic" | "scripted" =>
  process.env.CHATBOT_PROVIDER === "scripted" && process.env.NODE_ENV !== "production" ? "scripted" : "anthropic";

/** Can the chat actually answer right now? (A key is set, or the scripted provider is on.) */
export const chatConfigured = () => chatProvider() === "scripted" || Boolean(process.env.ANTHROPIC_API_KEY);

export const chatModel = () => process.env.CHATBOT_MODEL || "claude-opus-5-5";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export const chatEffort = (): Effort => {
  const e = process.env.CHATBOT_EFFORT;
  return e === "low" || e === "medium" || e === "high" || e === "xhigh" || e === "max" ? e : "medium";
};

/** Most the model may write in one answer. */
export const CHAT_MAX_TOKENS = 8000;
/** Most web lookups in one answer. */
export const MAX_SEARCHES = 4;
export const MAX_FETCHES = 3;
/** Most rounds of looking things up before it has to answer. */
export const MAX_ROUNDS = 6;

/** Cost and abuse limits: per person per hour and per day, and across everyone per day. Counted in the database so a sleeping server can't forget them. */
export const chatLimits = () => ({
  perHour: num("CHAT_PER_HOUR", 40),
  perDay: num("CHAT_PER_DAY", 150),
  siteDay: num("CHAT_SITE_PER_DAY", 1500),
});
