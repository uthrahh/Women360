import { prisma } from "@/lib/prisma";
import { TooManyRequestsError } from "@/lib/errors";

// Feedback is free text from a signed-in person, so cap how much one account
// can send. Generous for a human, a wall for a script.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

export const feedbackService = {
  async submit(userId: string, input: { rating: number; message?: string }) {
    const recent = await prisma.feedback.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
    });
    if (recent >= MAX_PER_WINDOW) {
      throw new TooManyRequestsError("You've sent a lot of feedback just now. Please try again a little later.");
    }
    const row = await prisma.feedback.create({
      data: { userId, rating: input.rating, message: input.message || null },
    });
    return { id: row.id, rating: row.rating, createdAt: row.createdAt };
  },

  // Operator view. Deliberately returns the account id, not name/email — an
  // admin who needs to follow up can look the id up in the user list.
  async list({ page, pageSize }: { page: number; pageSize: number }) {
    const [items, total] = await Promise.all([
      prisma.feedback.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, userId: true, rating: true, message: true, createdAt: true },
      }),
      prisma.feedback.count(),
    ]);
    return { items, total };
  },
};
