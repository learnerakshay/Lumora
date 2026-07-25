import { z } from 'zod';

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: z.string().min(1).optional(),
    CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
    VITE_CLERK_PUBLISHABLE_KEY: z
      .string()
      .min(1, 'VITE_CLERK_PUBLISHABLE_KEY is required'),
    OPENAI_API_KEY: z.string().trim().min(1).optional(),
    EMBEDDING_PROVIDER: z.literal('openai').default('openai'),
    EMBEDDING_MODEL: z
      .enum(['text-embedding-3-small', 'text-embedding-3-large'])
      .default('text-embedding-3-small'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
    EMBEDDING_VERSION: z.string().trim().min(1).default('v1'),
    TAVILY_API_KEY: z.string().optional(),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    CHAT_MODEL: z
      .enum(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'])
      .default('gpt-5.6-sol'),
    CHAT_REASONING_EFFORT: z
      .enum(['none', 'low', 'medium', 'high', 'xhigh'])
      .default('medium'),
    CHAT_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(60_000),
    CHAT_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(128).max(16_384).default(2_048),
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

    if (!env.OPENAI_API_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['OPENAI_API_KEY'],
        message: 'OPENAI_API_KEY is required in production',
      });
    }

    if (env.EMBEDDING_DIMENSIONS !== 1536) {
      context.addIssue({
        code: 'custom',
        path: ['EMBEDDING_DIMENSIONS'],
        message: 'EMBEDDING_DIMENSIONS must be 1536 for the configured pgvector schema',
      });
    }
  });

export function getServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('Server environment variables cannot be accessed on the client');
  }
  return serverEnvSchema.parse(process.env);
}
