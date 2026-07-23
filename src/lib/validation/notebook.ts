import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(120, "Name must be 120 characters or fewer.");
const descriptionSchema = z
  .string()
  .trim()
  .max(2_000, "Description must be 2,000 characters or fewer.")
  .nullable()
  .optional()
  .transform((value) =>
    value === undefined ? undefined : value?.trim() || null,
  );

export const createNotebookSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
});
export const updateNotebookSchema = z
  .object({ name: nameSchema.optional(), description: descriptionSchema })
  .refine(
    (value) => value.name !== undefined || value.description !== undefined,
    { message: "Provide a name or description to update." },
  );
export const notebookIdSchema = z.object({
  notebookId: z.string().cuid("Invalid notebook ID."),
});

export type CreateNotebookInput = z.infer<typeof createNotebookSchema>;
export type UpdateNotebookInput = z.infer<typeof updateNotebookSchema>;
