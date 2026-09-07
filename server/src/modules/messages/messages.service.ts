import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export const messagesService = {
  async list(recipientId: string) {
    return prisma.message.findMany({ where: { recipientId }, orderBy: { createdAt: "desc" } });
  },

  async markRead(recipientId: string, id: string) {
    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundError("Message not found.");
    if (message.recipientId !== recipientId) throw new ForbiddenError();
    return prisma.message.update({ where: { id }, data: { readAt: new Date() } });
  },
};
