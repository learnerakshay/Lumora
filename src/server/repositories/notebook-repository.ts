import "server-only";
import { prisma } from "@/lib/db/prisma";
import type {
  CreateNotebookInput,
  UpdateNotebookInput,
} from "@/lib/validation/notebook";

const listSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { sources: true, conversations: true } },
} as const;

export const notebookRepository = {
  list: () =>
    prisma.notebook.findMany({
      select: listSelect,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
  findById: (id: string) =>
    prisma.notebook.findUnique({
      where: { id },
      select: {
        ...listSelect,
        sources: {
          select: {
            id: true,
            title: true,
            sourceType: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
        },
        roadmaps: {
          select: { id: true, title: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
  create: (input: CreateNotebookInput) =>
    prisma.notebook.create({ data: input, select: listSelect }),
  update: (id: string, input: UpdateNotebookInput) =>
    prisma.notebook.update({ where: { id }, data: input, select: listSelect }),
  delete: (id: string) =>
    prisma.notebook.delete({ where: { id }, select: { id: true } }),
  exists: async (id: string) =>
    (await prisma.notebook.count({ where: { id } })) > 0,
};
