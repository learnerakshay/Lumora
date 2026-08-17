import type { Gap, GapReport, TargetRole } from '../skills/types';
import type { ReadinessBand, ReadinessReport } from './types';

function bandForPercent(percent: number): ReadinessBand {
  if (percent >= 80) return 'READY';
  if (percent >= 55) return 'CLOSE';
  if (percent >= 30) return 'DEVELOPING';
  return 'EARLY';
}

const BAND_SUMMARY: Record<ReadinessBand, string> = {
  READY: 'is close to interview-ready',
  CLOSE: 'is closing in on interview-ready',
  DEVELOPING: 'has real foundations but real gaps remain',
  EARLY: 'is early in building toward this role',
};

// Every number here is read directly from the Phase 1 fitScore and the
// selected gap set — nothing here is re-derived from the resume or a model.
export function buildReadinessReport(
  role: TargetRole,
  selectedGaps: readonly Gap[],
  report: GapReport,
): ReadinessReport {
  const readinessPercent = Math.round(role.fitScore * 100);
  const band = bandForPercent(readinessPercent);
  const blockingGapCount = selectedGaps.filter((gap) => gap.severity === 'HIGH').length;
  const strengthCount = report.strengths.filter((strength) => strength.roleId === role.roleId).length;
  return {
    roleId: role.roleId,
    roleTitle: role.title,
    readinessPercent,
    band,
    blockingGapCount,
    totalStepCount: selectedGaps.length,
    strengthCount,
    summary: `${role.title} ${BAND_SUMMARY[band]}, with ${blockingGapCount} high-priority gap${blockingGapCount === 1 ? '' : 's'} to close first.`,
  };
}
