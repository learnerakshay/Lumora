import { z } from 'zod';

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: z.string().min(1).optional(),
    CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
    VITE_CLERK_PUBLISHABLE_KEY: z
      .string()
      .min(1, 'VITE_CLERK_PUBLISHABLE_KEY is required'),
    OPENAI_API_KEY: z.string().optional(),
    TAVILY_API_KEY: z.string().optional(),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') {
      return;
    }

    if (!env.DIRECT_URL) {
      context.addIssue({
        code: 'custom',
        path: ['DIRECT_URL'],
        message: 'DIRECT_URL is required in production',
      });
    }

  });

export function getServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('Server environment variables cannot be accessed on the client');
  }
  return serverEnvSchema.parse(process.env);
}
