import { z } from 'zod';

const optionalSecret = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  z.string().trim().min(1).optional(),
);

// z.coerce.boolean() treats any non-empty string (including the literal
// string "false") as true, which makes it unsafe for env vars. This
// preprocess reads the literal "true"/"false" text instead.
const booleanFlag = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (typeof value !== 'string' || value.trim().length === 0) return defaultValue;
    return value.trim().toLowerCase() === 'true';
  }, z.boolean());

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: z.string().min(1).optional(),
    CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
    VITE_CLERK_PUBLISHABLE_KEY: z
      .string()
      .min(1, 'VITE_CLERK_PUBLISHABLE_KEY is required'),
    OPENAI_API_KEY: z.string().trim().min(1).optional(),
    GEMINI_API_KEY: optionalSecret,
    EMBEDDING_PROVIDER: z.literal('openai').default('openai'),
    EMBEDDING_MODEL: z
      .enum(['text-embedding-3-small', 'text-embedding-3-large'])
      .default('text-embedding-3-small'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
    EMBEDDING_VERSION: z.string().trim().min(1).default('v1'),
    INGESTION_STALE_AFTER_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .max(24 * 60 * 60 * 1_000)
      .default(15 * 60 * 1_000),
    INGESTION_RECOVERY_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(60 * 60 * 1_000)
      .default(60_000),
    INGESTION_MAX_RECOVERY_ATTEMPTS: z.coerce.number().int().min(0).max(5).default(2),
    YOUTUBE_TRANSCRIPT_PROVIDER: z.enum(['direct', 'proxy']).default('direct'),
    YOUTUBE_TRANSCRIPT_PROXY_URL: optionalSecret,
    YOUTUBE_TRANSCRIPT_PROXY_TOKEN: optionalSecret,
    YOUTUBE_TRANSCRIPT_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(5_000)
      .max(60_000)
      .default(25_000),
    TAVILY_API_KEY: optionalSecret,
    TAVILY_MAX_RESULTS: z.coerce.number().int().min(1).max(10).default(5),
    TAVILY_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000).default(10_000),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    CHAT_MODEL: z
      .enum(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'])
      .default('gpt-5.6-sol'),
    CHAT_REASONING_EFFORT: z
      .enum(['none', 'low', 'medium', 'high', 'xhigh'])
      .default('medium'),
    CHAT_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(60_000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    // Payments (Razorpay Orders, one-time purchases only — no Subscriptions/Autopay).
    RAZORPAY_KEY_ID: optionalSecret,
    RAZORPAY_KEY_SECRET: optionalSecret,
    RAZORPAY_WEBHOOK_SECRET: optionalSecret,
    PAYMENTS_ENABLED: booleanFlag(false),
    PAYMENTS_CURRENCY: z.string().trim().min(1).default('INR'),
    PLAN_ACCESS_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    // Temporary escape hatch for Phase 2 E2E testing on Render, which runs
    // with NODE_ENV=production. Must default to false: production rejecting
    // rzp_test_ keys is the actual safety guarantee, and this flag exists
    // only to be flipped on deliberately, short-term, then unset again —
    // never to become the normal way production runs.
    ALLOW_RAZORPAY_TEST_KEYS: booleanFlag(false),
  })
  .superRefine((env, context) => {
    if (env.PAYMENTS_ENABLED) {
      if (!env.RAZORPAY_KEY_ID) {
        context.addIssue({
          code: 'custom',
          path: ['RAZORPAY_KEY_ID'],
          message: 'RAZORPAY_KEY_ID is required when PAYMENTS_ENABLED is true',
        });
      } else if (!/^rzp_(test|live)_/.test(env.RAZORPAY_KEY_ID)) {
        context.addIssue({
          code: 'custom',
          path: ['RAZORPAY_KEY_ID'],
          message: 'RAZORPAY_KEY_ID must start with rzp_test_ or rzp_live_',
        });
      } else if (
        env.NODE_ENV === 'production' &&
        env.RAZORPAY_KEY_ID.startsWith('rzp_test_') &&
        !env.ALLOW_RAZORPAY_TEST_KEYS
      ) {
        context.addIssue({
          code: 'custom',
          path: ['RAZORPAY_KEY_ID'],
          message:
            'Production must not use a Razorpay test-mode key unless ALLOW_RAZORPAY_TEST_KEYS=true is explicitly set',
        });
      }
      if (!env.RAZORPAY_KEY_SECRET) {
        context.addIssue({
          code: 'custom',
          path: ['RAZORPAY_KEY_SECRET'],
          message: 'RAZORPAY_KEY_SECRET is required when PAYMENTS_ENABLED is true',
        });
      }
      if (!env.RAZORPAY_WEBHOOK_SECRET) {
        context.addIssue({
          code: 'custom',
          path: ['RAZORPAY_WEBHOOK_SECRET'],
          message: 'RAZORPAY_WEBHOOK_SECRET is required when PAYMENTS_ENABLED is true',
        });
      }
    }

    if (env.YOUTUBE_TRANSCRIPT_PROVIDER === 'proxy') {
      if (!env.YOUTUBE_TRANSCRIPT_PROXY_URL) {
        context.addIssue({
          code: 'custom',
          path: ['YOUTUBE_TRANSCRIPT_PROXY_URL'],
          message: 'YOUTUBE_TRANSCRIPT_PROXY_URL is required when the proxy provider is selected',
        });
      } else {
        try {
          const proxyUrl = new URL(env.YOUTUBE_TRANSCRIPT_PROXY_URL);
          if (proxyUrl.protocol !== 'https:' || proxyUrl.username || proxyUrl.password) {
            throw new Error('invalid proxy URL');
          }
        } catch {
          context.addIssue({
            code: 'custom',
            path: ['YOUTUBE_TRANSCRIPT_PROXY_URL'],
            message: 'YOUTUBE_TRANSCRIPT_PROXY_URL must be a public HTTPS URL without credentials',
          });
        }
      }
      if (!env.YOUTUBE_TRANSCRIPT_PROXY_TOKEN) {
        context.addIssue({
          code: 'custom',
          path: ['YOUTUBE_TRANSCRIPT_PROXY_TOKEN'],
          message: 'YOUTUBE_TRANSCRIPT_PROXY_TOKEN is required when the proxy provider is selected',
        });
      }
    }

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

    if (!env.GEMINI_API_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['GEMINI_API_KEY'],
        message: 'GEMINI_API_KEY is required in production',
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
