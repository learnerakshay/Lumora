import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { findCouponByCode } from '../src/lib/payments/coupon-store';
import { normalizeCouponCode } from '../src/lib/payments/coupon';

// Renames a coupon's code in place, preserving every other field (kind,
// value, appliesToPlans, maxRedemptions, redemptionCount, perUserLimit,
// validUntil, active). coupon-store.ts has no update-code operation (its
// module is the frozen Phase 1 coupon surface), so this talks to prisma
// directly rather than adding a new write path there — the same pattern the
// existing payments:inspect-order script uses for one-off admin reads.
//
// Usage: npx tsx scripts/payments-rename-coupon.ts <OLD_CODE> <NEW_CODE>
async function main() {
  const [, , oldCodeArg, newCodeArg] = process.argv;
  if (!oldCodeArg || !newCodeArg) {
    throw new Error('Usage: npx tsx scripts/payments-rename-coupon.ts <OLD_CODE> <NEW_CODE>');
  }

  const existing = await findCouponByCode(oldCodeArg);
  if (!existing) {
    throw new Error(`Coupon "${oldCodeArg}" was not found.`);
  }

  const newCode = normalizeCouponCode(newCodeArg);
  const clash = await findCouponByCode(newCode);
  if (clash) {
    throw new Error(`Coupon "${newCode}" already exists (id: ${clash.id}) — cannot rename onto it.`);
  }

  const updated = await prisma.coupon.update({
    where: { id: existing.id },
    data: { code: newCode },
  });

  console.log(JSON.stringify(updated, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
