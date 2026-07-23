import "server-only";
import { prisma } from "@/lib/db/prisma";

export const sourceRepository = {
  listMetadataByNotebook: (notebookId: string) =>
    prisma.source.findMany({
      where: { notebookId },
      select: {
        id: true,
        title: true,
        sourceType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
};
