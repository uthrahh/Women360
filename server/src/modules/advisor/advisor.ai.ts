import { z } from "zod";
import { chatModel } from "@/modules/chat/chat.config";
import type { ChatSummary } from "@/modules/chat/chat.summary";
import { FORBIDDEN, type Idea } from "./ideas";

/** The one SDK call this file makes, so tests can stand in for it without a key or a network. */
export interface AdvisorClient {
  beta: { messages: { create(params: Record<string, unknown>): Promise<{ content: { type: string; name?: string; input?: unknown }[] }> } };
}

const TOOL = "suggest_ideas";
const AREAS = ["water", "food", "movement", "sleep", "wellbeing", "check-up"] as const;

/**
 * The brief for the AI advisor. It may suggest only small everyday self-care habits and routine check-ups, from her numbers-only
 * summary; never a diagnosis, treatment, medicine, supplement, dose, fasting, or a weight or calorie target. Awaits clinical review
 * like the chat's brief (CLAUDE.md, chat).
 */
export const ADVISOR_SYSTEM = `You are the health advisor inside Women360, an app where people track their own health to prevent problems early.
You get a numbers-only summary of one person's last 30 days of logs (no names, notes or medicines) and the habits they already have.
Suggest up to 4 small, everyday preventive self-care actions that fit what their numbers show. Each must:
- be a habit doable in 15 minutes or less (with how many days a week), or a one-off such as booking a routine check-up;
- say why in one short sentence that cites their own numbers from the summary (for example "Your sleep averaged 5.8 hours this week");
- not repeat a habit they already have.
Never diagnose, name a condition or disease, mention a medicine, supplement or dose, suggest fasting, weight loss or a calorie number,
or quote a guideline figure. Plain, kind words; no exclamation marks. If the numbers show nothing to work on, suggest fewer ideas.
Answer only by calling the ${TOOL} tool.`;

const toolDef = {
  name: TOOL,
  description: "Return the suggested ideas.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["ideas"],
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "why", "area", "type", "daysPerWeek", "minutes"],
          properties: {
            title: { type: "string", description: "The habit or goal, under 60 characters, starting with a verb or a noun phrase." },
            why: { type: "string", description: "One sentence citing their own numbers." },
            area: { type: "string", enum: [...AREAS] },
            type: { type: "string", enum: ["habit", "goal"] },
            daysPerWeek: { type: "integer", description: "1 to 7 for a habit; 1 for a goal." },
            minutes: { type: ["integer", "null"], description: "Minutes per day for a timed habit, or null." },
          },
        },
      },
    },
  },
};

const output = z.object({
  ideas: z.array(
    z.object({
      title: z.string().trim().min(3).max(70),
      why: z.string().trim().min(3).max(240),
      area: z.enum(AREAS),
      type: z.enum(["habit", "goal"]),
      daysPerWeek: z.number().int().min(1).max(7),
      minutes: z.number().int().min(1).max(60).nullable(),
    })
  ),
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** Turns the model's tool input into ideas, dropping anything malformed, forbidden or already a habit. Never trusts the model's text as more than data. */
export function toIdeas(input: unknown, existing: string[]): Idea[] {
  const parsed = output.safeParse(input);
  if (!parsed.success) return [];
  const have = new Set(existing.map((t) => t.toLowerCase().trim()));
  return parsed.data.ideas
    .filter((x) => !FORBIDDEN.test(x.title) && !FORBIDDEN.test(x.why) && !have.has(x.title.toLowerCase()))
    .slice(0, 4)
    .map((x, n) => ({
      key: "ai-" + slug(x.title),
      area: x.area,
      title: x.title,
      why: x.why,
      fit: 60 - n,
      source: "ai" as const,
      action:
        x.type === "goal"
          ? { type: "goal" as const, title: x.title, category: x.area === "check-up" ? ("PREVENTIVE" as const) : ("OTHER" as const) }
          : { type: "habit" as const, title: x.title, daysPerWeek: x.daysPerWeek, target: x.minutes, unit: x.minutes ? "minutes" : null },
    }));
}

export async function aiIdeas(client: AdvisorClient, summary: ChatSummary, existing: string[]): Promise<Idea[]> {
  const res = await client.beta.messages.create({
    model: chatModel(),
    max_tokens: 2000,
    system: ADVISOR_SYSTEM,
    tools: [toolDef],
    tool_choice: { type: "tool", name: TOOL },
    messages: [{ role: "user", content: JSON.stringify({ summary, existingHabits: existing }) }],
  });
  const call = res.content.find((b) => b.type === "tool_use" && b.name === TOOL);
  return call ? toIdeas(call.input, existing) : [];
}

/** The offline stand-in used by the browser tests and local development (CHATBOT_PROVIDER=scripted): fixed ideas, no network. */
export function scriptedIdeas(existing: string[]): Idea[] {
  return toIdeas(
    {
      ideas: [
        { title: "Stretch for 5 minutes after waking", why: "Your activity was lower this week than in your earlier weeks.", area: "movement", type: "habit", daysPerWeek: 5, minutes: 5 },
        { title: "A short walk in daylight", why: "Your energy averaged lower this week.", area: "wellbeing", type: "habit", daysPerWeek: 3, minutes: 10 },
        { title: "Take a daily supplement", why: "This one must be dropped by the safety filter.", area: "food", type: "habit", daysPerWeek: 7, minutes: null },
      ],
    },
    existing
  );
}
