import { prisma } from '../prisma';

// Coupon code that grants faculty/instructor status on capture, regardless
// of which plan (CORE or MAX) it was applied to. Deliberately not a config
// value alongside PLAN_PRICING_PAISE — this is a one-off hackathon-cohort
// concept, not a pricing constant.
export const FACULTY_COUPON_CODE = 'CHAICODE99';

export interface FacultyStatus {
  isFaculty: boolean;
  hasSeenFacultyWelcome: boolean;
}

export async function getFacultyStatus(userId: string): Promise<FacultyStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isFaculty: true, hasSeenFacultyWelcome: true },
  });
  return { isFaculty: user?.isFaculty ?? false, hasSeenFacultyWelcome: user?.hasSeenFacultyWelcome ?? false };
}

// Grants faculty status and re-arms the welcome modal. Called once per
// FACULTY_COUPON_CODE capture (see capture-service.ts) — deliberately
// resets hasSeenFacultyWelcome to false even for an already-faculty user,
// so a renewal/upgrade purchased again with this coupon re-shows the
// welcome modal rather than silently staying dismissed.
export async function markFacultyEntitlement(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isFaculty: true, hasSeenFacultyWelcome: false },
  });
}

export async function markFacultyWelcomeSeen(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { hasSeenFacultyWelcome: true },
  });
}
