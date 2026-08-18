import assert from 'node:assert/strict';
import test from 'node:test';
import { getServerEnv } from './env';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://user:pass@host/db',
  CLERK_SECRET_KEY: 'sk_test_abc',
  VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
};

const PRODUCTION_REQUIRED_ENV = {
  ...BASE_ENV,
  NODE_ENV: 'production',
  DIRECT_URL: 'postgresql://user:pass@host/db',
  OPENAI_API_KEY: 'sk-abc',
  GEMINI_API_KEY: 'gemini-key',
  EMBEDDING_DIMENSIONS: '1536',
};

const ALL_ENV_KEYS = [
  ...Object.keys(BASE_ENV),
  ...Object.keys(PRODUCTION_REQUIRED_ENV),
  'NODE_ENV',
  'PAYMENTS_ENABLED',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'ALLOW_RAZORPAY_TEST_KEYS',
];

// getServerEnv() re-parses process.env on every call (no module-level
// caching), so each test can freely mutate process.env and call it again.
function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const original = { ...process.env };
  try {
    for (const key of ALL_ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) process.env[key] = value;
    }
    return fn();
  } finally {
    process.env = original;
  }
}

test('a development environment with payments disabled and no Razorpay vars parses cleanly', () => {
  withEnv({ ...BASE_ENV, NODE_ENV: 'development' }, () => {
    const env = getServerEnv();
    assert.equal(env.PAYMENTS_ENABLED, false);
    assert.equal(env.ALLOW_RAZORPAY_TEST_KEYS, false);
    assert.equal(env.RAZORPAY_KEY_ID, undefined);
  });
});

test('a development environment with a test-mode key and payments enabled parses cleanly (the flag is irrelevant outside production)', () => {
  withEnv(
    {
      ...BASE_ENV,
      NODE_ENV: 'development',
      PAYMENTS_ENABLED: 'true',
      RAZORPAY_KEY_ID: 'rzp_test_abc123',
      RAZORPAY_KEY_SECRET: 'secret',
      RAZORPAY_WEBHOOK_SECRET: 'whsec',
    },
    () => {
      const env = getServerEnv();
      assert.equal(env.RAZORPAY_KEY_ID, 'rzp_test_abc123');
    },
  );
});

test('production with a test-mode key and ALLOW_RAZORPAY_TEST_KEYS unset (default false) is rejected', () => {
  withEnv(
    {
      ...PRODUCTION_REQUIRED_ENV,
      PAYMENTS_ENABLED: 'true',
      RAZORPAY_KEY_ID: 'rzp_test_abc123',
      RAZORPAY_KEY_SECRET: 'secret',
      RAZORPAY_WEBHOOK_SECRET: 'whsec',
    },
    () => {
      assert.throws(() => getServerEnv(), /ALLOW_RAZORPAY_TEST_KEYS/);
    },
  );
});

test('production with a test-mode key and ALLOW_RAZORPAY_TEST_KEYS explicitly "false" is still rejected', () => {
  withEnv(
    {
      ...PRODUCTION_REQUIRED_ENV,
      PAYMENTS_ENABLED: 'true',
      RAZORPAY_KEY_ID: 'rzp_test_abc123',
      RAZORPAY_KEY_SECRET: 'secret',
      RAZORPAY_WEBHOOK_SECRET: 'whsec',
      ALLOW_RAZORPAY_TEST_KEYS: 'false',
    },
    () => {
      assert.throws(() => getServerEnv(), /ALLOW_RAZORPAY_TEST_KEYS/);
    },
  );
});

// The actual purpose of this change: Render runs NODE_ENV=production, and
// Phase 2 E2E testing needs a real rzp_test_ key to work there until a live
// key exists.
test('production with a test-mode key and ALLOW_RAZORPAY_TEST_KEYS="true" is explicitly permitted', () => {
  withEnv(
    {
      ...PRODUCTION_REQUIRED_ENV,
      PAYMENTS_ENABLED: 'true',
      RAZORPAY_KEY_ID: 'rzp_test_abc123',
      RAZORPAY_KEY_SECRET: 'secret',
      RAZORPAY_WEBHOOK_SECRET: 'whsec',
      ALLOW_RAZORPAY_TEST_KEYS: 'true',
    },
    () => {
      const env = getServerEnv();
      assert.equal(env.RAZORPAY_KEY_ID, 'rzp_test_abc123');
      assert.equal(env.ALLOW_RAZORPAY_TEST_KEYS, true);
    },
  );
});

test('ALLOW_RAZORPAY_TEST_KEYS is case-insensitive, matching the existing booleanFlag convention', () => {
  withEnv(
    {
      ...PRODUCTION_REQUIRED_ENV,
      PAYMENTS_ENABLED: 'true',
      RAZORPAY_KEY_ID: 'rzp_test_abc123',
      RAZORPAY_KEY_SECRET: 'secret',
      RAZORPAY_WEBHOOK_SECRET: 'whsec',
      ALLOW_RAZORPAY_TEST_KEYS: 'TRUE',
    },
    () => {
      const env = getServerEnv();
      assert.equal(env.ALLOW_RAZORPAY_TEST_KEYS, true);
    },
  );
});

test('production with a LIVE-mode key succeeds regardless of ALLOW_RAZORPAY_TEST_KEYS — the flag only ever widens test-key access', () => {
  withEnv(
    {
      ...PRODUCTION_REQUIRED_ENV,
      PAYMENTS_ENABLED: 'true',
      RAZORPAY_KEY_ID: 'rzp_live_abc123',
      RAZORPAY_KEY_SECRET: 'secret',
      RAZORPAY_WEBHOOK_SECRET: 'whsec',
      // deliberately omitted / false
    },
    () => {
      const env = getServerEnv();
      assert.equal(env.RAZORPAY_KEY_ID, 'rzp_live_abc123');
    },
  );
});

// The flag must not weaken the underlying key-format check — it only
// suppresses the "no test keys in production" rule, nothing else.
test('ALLOW_RAZORPAY_TEST_KEYS=true does not bypass the general rzp_test_/rzp_live_ prefix format check', () => {
  withEnv(
    {
      ...PRODUCTION_REQUIRED_ENV,
      PAYMENTS_ENABLED: 'true',
      RAZORPAY_KEY_ID: 'not-a-real-key-format',
      RAZORPAY_KEY_SECRET: 'secret',
      RAZORPAY_WEBHOOK_SECRET: 'whsec',
      ALLOW_RAZORPAY_TEST_KEYS: 'true',
    },
    () => {
      assert.throws(() => getServerEnv(), /must start with rzp_test_ or rzp_live_/);
    },
  );
});

test('ALLOW_RAZORPAY_TEST_KEYS="true" with PAYMENTS_ENABLED still false has no effect (the payments block never runs)', () => {
  withEnv(
    {
      ...PRODUCTION_REQUIRED_ENV,
      PAYMENTS_ENABLED: 'false',
      ALLOW_RAZORPAY_TEST_KEYS: 'true',
    },
    () => {
      const env = getServerEnv();
      assert.equal(env.PAYMENTS_ENABLED, false);
      assert.equal(env.ALLOW_RAZORPAY_TEST_KEYS, true);
    },
  );
});

test('production still requires RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET even with ALLOW_RAZORPAY_TEST_KEYS=true', () => {
  withEnv(
    {
      ...PRODUCTION_REQUIRED_ENV,
      PAYMENTS_ENABLED: 'true',
      RAZORPAY_KEY_ID: 'rzp_test_abc123',
      ALLOW_RAZORPAY_TEST_KEYS: 'true',
      // RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET intentionally omitted
    },
    () => {
      assert.throws(() => getServerEnv(), /RAZORPAY_KEY_SECRET is required/);
    },
  );
});
