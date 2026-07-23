import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import {
  notebookIdSchema,
  updateNotebookSchema,
} from "@/lib/validation/notebook";
import { notebookService } from "@/server/services/notebook-service";

type Context = { params: Promise<{ notebookId: string }> };
function errorResponse(error: unknown) {
  if (error instanceof z.ZodError)
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request.",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  if (error instanceof AppError)
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    },
    { status: 500 },
  );
}
async function idFrom(context: Context) {
  return notebookIdSchema.parse(await context.params).notebookId;
}

export async function GET(_: Request, context: Context) {
  try {
    return NextResponse.json({
      data: await notebookService.get(await idFrom(context)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const id = await idFrom(context);
    const payload = updateNotebookSchema.parse(await request.json());
    return NextResponse.json({
      data: await notebookService.update(id, payload),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(_: Request, context: Context) {
  try {
    await notebookService.delete(await idFrom(context));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
