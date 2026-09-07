import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

export const learnService = {
  async listPublished() {
    return prisma.learnArticle.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
    });
  },

  async get(id: string) {
    const article = await prisma.learnArticle.findUnique({ where: { id } });
    if (!article || !article.publishedAt) throw new NotFoundError("Article not found.");
    return article;
  },

  // Admin-only content management (FR-21) --------------------------------
  async listAll() {
    return prisma.learnArticle.findMany({ orderBy: { createdAt: "desc" } });
  },

  async create(input: {
    title: string; category: string; readMins: number; dek: string; body?: string; publish: boolean;
  }) {
    const { publish, ...rest } = input;
    return prisma.learnArticle.create({ data: { ...rest, publishedAt: publish ? new Date() : null } });
  },

  async update(id: string, input: Partial<{
    title: string; category: string; readMins: number; dek: string; body: string; publish: boolean;
  }>) {
    const { publish, ...rest } = input;
    return prisma.learnArticle.update({
      where: { id },
      data: { ...rest, ...(publish !== undefined ? { publishedAt: publish ? new Date() : null } : {}) },
    });
  },

  async remove(id: string) {
    await prisma.learnArticle.delete({ where: { id } });
  },
};
