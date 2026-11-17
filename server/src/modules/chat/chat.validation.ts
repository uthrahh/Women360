import { z } from "zod";

/** One message of the conversation so far. The browser keeps the conversation (Women360 keeps none) and sends it each time. */
const message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "Write a message first.").max(12_000),
});

export const chatMessageSchema = z
  .object({
    /** Her own calendar day, so "today" and the 30-day window are hers. */
    today: z.string().date(),
    messages: z.array(message).min(1).max(20),
  })
  .superRefine((value, ctx) => {
    const last = value.messages[value.messages.length - 1];
    // An empty list is already refused above; refinements still run, so guard it.
    if (last && last.role !== "user") ctx.addIssue({ code: "custom", message: "The last message must be hers.", path: ["messages"] });
    value.messages.forEach((m, i) => {
      // What she types is capped well below what the chat may write back.
      if (m.role === "user" && m.content.length > 4000) ctx.addIssue({ code: "custom", message: "That message is too long. Keep it under 4,000 characters.", path: ["messages", i, "content"] });
    });
  });

export const sharingSchema = z.object({ share: z.boolean() });
