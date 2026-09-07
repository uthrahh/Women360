import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export const notificationsService = {
  async list(userId: string) {
    return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  },

  async markRead(userId: string, id: string) {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundError("Notification not found.");
    if (notification.userId !== userId) throw new ForbiddenError();
    return prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  },
};
