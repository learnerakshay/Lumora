import "server-only";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import type {
  CreateNotebookInput,
  UpdateNotebookInput,
} from "@/lib/validation/notebook";
import { notebookRepository } from "@/server/repositories/notebook-repository";

function databaseError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  )
    throw new AppError("NOT_FOUND", "Notebook not found.", 404);
  throw new AppError(
    "DATABASE_ERROR",
    "The database request could not be completed.",
    500,
  );
}

export const notebookService = {
  async list() {
    try {
      return await notebookRepository.list();
    } catch (error) {
      databaseError(error);
    }
  },
  async get(id: string) {
    try {
      const notebook = await notebookRepository.findById(id);
      if (!notebook)
        throw new AppError("NOT_FOUND", "Notebook not found.", 404);
      return notebook;
    } catch (error) {
      if (error instanceof AppError) throw error;
      databaseError(error);
    }
  },
  async create(input: CreateNotebookInput) {
    try {
      return await notebookRepository.create(input);
    } catch (error) {
      databaseError(error);
    }
  },
  async update(id: string, input: UpdateNotebookInput) {
    try {
      return await notebookRepository.update(id, input);
    } catch (error) {
      databaseError(error);
    }
  },
  async delete(id: string) {
    try {
      await notebookRepository.delete(id);
    } catch (error) {
      databaseError(error);
    }
  },
};
