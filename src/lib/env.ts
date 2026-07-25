import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().optional().default("postgresql://user:password@localhost:5432/lumora"),
  DIRECT_URL: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  APP_URL: z.string().default("http://localhost:3000"),
});

export function getServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('Server environment variables cannot be accessed on the client!');
  }
  return serverEnvSchema.parse(process.env);
}

export function getClientEnv() {
  const envSource = typeof window !== 'undefined' 
    ? (import.meta as any).env || {}
    : process.env;

  return clientEnvSchema.parse({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: envSource.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || envSource.VITE_CLERK_PUBLISHABLE_KEY,
    VITE_CLERK_PUBLISHABLE_KEY: envSource.VITE_CLERK_PUBLISHABLE_KEY || envSource.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    APP_URL: envSource.APP_URL || envSource.VITE_APP_URL || "http://localhost:3000",
  });
}
