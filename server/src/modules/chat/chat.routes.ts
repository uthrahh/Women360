import Anthropic from "@anthropic-ai/sdk";
import { Router, type NextFunction, type Request, type Response } from "express";
import { asyncHandler } from "@/lib/asyncHandler";
import { assertPlausibleDay } from "@/lib/days";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { forbidDemo } from "@/middleware/demoGuard";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { runAnthropicChat, type ChatClient } from "./chat.anthropic";
import { chatConfigured, chatEnabled, chatLimits, chatProvider } from "./chat.config";
import type { ChatEvent, ChatRun } from "./chat.events";
import { takeChatTurn } from "./chat.limits";
import { buildSystemPrompt } from "./chat.prompt";
import { runScriptedChat } from "./chat.scripted";
import { buildSummary } from "./chat.summary";
import { chatMessageSchema, sharingSchema } from "./chat.validation";

export const chatRouter = Router();

// Signed in, never a shared demo account (they cost real money and anyone can sign in to them), and only while the owner has switched the chat on.
chatRouter.use(requireAuth, forbidDemo, (_req: Request, _res: Response, next: NextFunction) => (chatEnabled() ? next() : next(new NotFoundError("Not found."))));

let client: Anthropic | null = null;
const anthropic = (): ChatClient => (client ??= new Anthropic({ timeout: 120_000, maxRetries: 2 })) as unknown as ChatClient;

chatRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { chatShareConsentAt: true } });
    const limits = chatLimits();
    return ok(res, { configured: chatConfigured(), sharing: user.chatShareConsentAt !== null, limits: { perHour: limits.perHour, perDay: limits.perDay } });
  })
);

// Agreeing (or stopping) is her choice, made on the chat screen; the server is what enforces it, not the screen.
chatRouter.put(
  "/sharing",
  validate({ body: sharingSchema }),
  asyncHandler(async (req, res) => {
    const share = (req.body as { share: boolean }).share;
    await prisma.user.update({ where: { id: req.user!.id }, data: { chatShareConsentAt: share ? new Date() : null } });
    return ok(res, { sharing: share });
  })
);

chatRouter.post(
  "/message",
  validate({ body: chatMessageSchema }),
  asyncHandler(async (req, res) => {
    const { today, messages } = req.body as { today: string; messages: { role: "user" | "assistant"; content: string }[] };
    assertPlausibleDay(today);
    if (!chatConfigured()) {
      return res.status(503).json({ ok: false, error: { code: "CHAT_NOT_SET_UP", message: "The chat isn't set up yet." } });
    }
    const userId = req.user!.id;
    const turn = await takeChatTurn(userId);
    if (!turn.ok) {
      const message = turn.reason === "site" ? "The chat is very busy today. Please try again tomorrow." : turn.retry === "hour" ? "You've asked a lot this hour. Please try again in a while." : "You've reached today's chat limit. Please try again tomorrow.";
      return res.status(429).json({ ok: false, error: { code: "CHAT_LIMIT", message } });
    }

    // Her choice, read fresh on every question.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { chatShareConsentAt: true } });
    const sharing = user.chatShareConsentAt !== null;

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const abort = new AbortController();
    res.on("close", () => abort.abort());
    const emit = (event: ChatEvent) => {
      if (!res.writableEnded && !abort.signal.aborted) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    const keepAlive = setInterval(() => !res.writableEnded && res.write(": keep-alive\n\n"), 15_000);

    const run: ChatRun = {
      messages,
      system: buildSystemPrompt({ today, sharing }),
      summary: sharing ? () => buildSummary(userId, today) : null,
      emit,
      signal: abort.signal,
    };
    try {
      if (chatProvider() === "scripted") await runScriptedChat(run);
      else await runAnthropicChat(anthropic(), run);
    } catch (err) {
      if (!abort.signal.aborted) {
        // Never the question or the answer: only that it failed, and why in general terms.
        logger.error({ err: err instanceof Error ? err.name : "unknown" }, "AI chat failed");
        emit({ type: "error", message: "The chat couldn't answer just now. Please try again in a moment." });
      }
    } finally {
      clearInterval(keepAlive);
      if (!res.writableEnded) res.end();
    }
  })
);
