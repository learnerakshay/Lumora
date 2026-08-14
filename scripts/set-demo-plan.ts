import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { PLAN_NAMES, type PlanName } from '../src/lib/usage/config';
import { setUserPlanForDemo } from '../src/lib/usage/service';

const [, , userId, requestedPlan] = process.argv;

async function main() {
  if (!userId || !PLAN_NAMES.includes(requestedPlan as PlanName)) {
    throw new Error('Usage: npm run demo:set-plan -- <clerk-user-id> <FREE|CORE|MAX>');
  }
  await setUserPlanForDemo(userId, requestedPlan as PlanName);
  console.log(`Demo user plan updated to ${requestedPlan}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
