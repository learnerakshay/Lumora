import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db/health";

export const runtime = "nodejs";

export async function GET() {
  const database = await checkDatabaseHealth();
  const status = database.status === "unavailable" ? "degraded" : "ok";
  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "development",
      database,
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
