import "server-only";
import { prisma } from "@/lib/db/prisma";

export async function checkDatabaseHealth(): Promise<{
  status: "connected" | "not-configured" | "unavailable";
}> {
  if (!process.env.DATABASE_URL) return { status: "not-configured" };
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return { status: "connected" };
  } catch {
    return { status: "unavailable" };
  }
}
