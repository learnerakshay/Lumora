import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { findCouponByCode } from '../src/lib/payments/coupon-store';

// Updates an existing coupon's redemption limits in place, preserving every
// other field (code, kind, value, appliesToPlans, redemptionCount,
// validUntil, active). coupon-store.ts has no update-limits operation (its
// module is the frozen Phase 1 coupon surface), so this talks to prisma
// directly — the same pattern payments-rename-coupon.ts and
// payments:inspect-order already use for one-off admin writes/reads.
//
// Usage: npx tsx scripts/payments-update-coupon.ts <CODE> --maxRedemptions=15 [--perUserLimit=N]
async function main() {
  const [, , codeArg, ...rest] = process.argv;
  if (!codeArg) {
    throw new Error('Usage: npx tsx scripts/payments-update-coupon.ts <CODE> [--maxRedemptions=N] [--perUserLimit=N]');
  }

  const existing = await findCouponByCode(codeArg);
  if (!existing) {
    throw new Error(`Coupon "${codeArg}" was not found.`);
  }
  console.log('Before:', JSON.stringify(existing, null, 2));

  const data: { maxRedemptions?: number; perUserLimit?: number } = {};
  for (const arg of rest) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key === 'maxRedemptions') data.maxRedemptions = Number(value);
    if (key === 'perUserLimit') data.perUserLimit = Number(value);
  }
  if (Object.keys(data).length === 0) {
    throw new Error('Provide at least one of --maxRedemptions=N or --perUserLimit=N.');
  }
  if (data.maxRedemptions !== undefined && data.maxRedemptions < existing.redemptionCount) {
    throw new Error(
      `Refusing to set maxRedemptions (${data.maxRedemptions}) below the current redemptionCount (${existing.redemptionCount}).`,
    );
  }

  const updated = await prisma.coupon.update({
    where: { id: existing.id },
    data,
  });

  console.log('After:', JSON.stringify(updated, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
