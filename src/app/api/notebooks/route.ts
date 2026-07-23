import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import { createNotebookSchema } from "@/lib/validation/notebook";
import { notebookService } from "@/server/services/notebook-service";

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

export async function GET() {
  try {
    return NextResponse.json({ data: await notebookService.list() });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const payload = createNotebookSchema.parse(await request.json());
    return NextResponse.json(
      { data: await notebookService.create(payload) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
