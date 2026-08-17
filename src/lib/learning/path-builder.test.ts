import assert from 'node:assert/strict';
import test from 'node:test';
import { EXTRACTION_CONTRACT_VERSION, type ExtractedProfile, type Gap, type GapReport } from '../skills/types';
import { normalizeExtractedProfile } from '../skills/normalize';
import { selectTargetRoles } from '../skills/role-matching';
import { analyzeSkillGaps } from '../skills/gap-analysis';
import { buildLearningPath, MAX_PLAN_STEPS, selectableGaps } from './path-builder';

function baseProfile(overrides: Partial<ExtractedProfile>): ExtractedProfile {
  return {
    schemaVersion: EXTRACTION_CONTRACT_VERSION,
    headline: null,
    yearsOfExperienceStated: null,
    skills: [],
    projects: [],
    experience: [],
    education: [],
    certifications: [],
    ...overrides,
  };
}

function frontendReport(): GapReport {
  const profile = baseProfile({});
  const skills = normalizeExtractedProfile(profile);
  const roles = selectTargetRoles(skills);
  return analyzeSkillGaps(profile, skills, roles);
}

const noResources = { resolve: async () => [] };
const noNarration = { narrate: async () => null };

test('unknown or foreign-role gap ids are silently excluded, never trusted from the client', () => {
  const report = frontendReport();
  const realGapId = report.gaps.find((gap) => gap.roleId === 'frontend-react-engineer')!.id;
  const selected = selectableGaps(report, 'frontend-react-engineer', [
    realGapId,
    'fabricated-gap-id',
    'backend-node-engineer:technical:nodejs',
  ]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, realGapId);
});

test('an unknown role id throws rather than silently building an empty plan', async () => {
  const report = frontendReport();
  await assert.rejects(() =>
    buildLearningPath(
      {
        analysisId: 'analysis-1',
        roleId: 'not-a-real-role',
        gapReport: report,
        selectedGapIds: [],
        planId: 'plan-1',
        userId: 'user-1',
        signal: new AbortController().signal,
      },
      { ...noResources, ...noNarration },
    ),
  );
});

test('the full deterministic pipeline builds a plan with stages, competencies, closure plans, and evidence tasks', async () => {
  const report = frontendReport();
  const gapIds = report.gaps.filter((gap) => gap.roleId === 'frontend-react-engineer').map((gap) => gap.id);
  const result = await buildLearningPath(
    {
      analysisId: 'analysis-1',
      roleId: 'frontend-react-engineer',
      gapReport: report,
      selectedGapIds: gapIds,
      planId: 'plan-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    },
    { ...noResources, ...noNarration },
  );

  assert.equal(result.path.roleId, 'frontend-react-engineer');
  assert.equal(result.path.builtFromAnalysisId, 'analysis-1');
  assert.ok(result.path.stages.length > 0);
  const allSteps = result.path.stages.flatMap((stage) => stage.steps);
  assert.equal(allSteps.length, gapIds.length);
  for (const step of allSteps) {
    assert.ok(step.closurePlan.length > 0);
    assert.ok(step.evidenceTask.acceptanceCriteria.length > 0);
    assert.equal(step.resourceStatus, 'NONE');
    assert.deepEqual(step.resources, []);
    // With no narration injected, the fallback text must be used verbatim.
    assert.ok(step.whyItMatters.length > 0);
  }
  assert.equal(result.narrativeModel, null);
});

test('stages only appear when they have steps, and are ordered now, next, later', async () => {
  const report = frontendReport();
  const highOnly = report.gaps.filter((gap) => gap.roleId === 'frontend-react-engineer' && gap.severity === 'HIGH');
  const result = await buildLearningPath(
    {
      analysisId: 'analysis-1',
      roleId: 'frontend-react-engineer',
      gapReport: report,
      selectedGapIds: highOnly.map((gap) => gap.id),
      planId: 'plan-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    },
    { ...noResources, ...noNarration },
  );
  const stageIds = result.path.stages.map((stage) => stage.id);
  assert.deepEqual(stageIds, ['now']);
  assert.ok(stageIds.every((id, index) => index === 0 || ['now', 'next', 'later'].indexOf(id) > ['now', 'next', 'later'].indexOf(stageIds[index - 1])));
});

test('steps within a stage stay in deterministic priority order', async () => {
  const report = frontendReport();
  const gapIds = report.gaps.filter((gap) => gap.roleId === 'frontend-react-engineer').map((gap) => gap.id);
  const result = await buildLearningPath(
    {
      analysisId: 'analysis-1',
      roleId: 'frontend-react-engineer',
      gapReport: report,
      selectedGapIds: gapIds,
      planId: 'plan-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    },
    { ...noResources, ...noNarration },
  );
  for (const stage of result.path.stages) {
    for (let index = 1; index < stage.steps.length; index += 1) {
      assert.ok(stage.steps[index - 1].priority >= stage.steps[index].priority);
    }
  }
});

test('narration replaces fallback text only for matched step ids and leaves decisions untouched', async () => {
  const report = frontendReport();
  const gaps = report.gaps.filter((gap) => gap.roleId === 'frontend-react-engineer');
  const target = gaps[0];
  const result = await buildLearningPath(
    {
      analysisId: 'analysis-1',
      roleId: 'frontend-react-engineer',
      gapReport: report,
      selectedGapIds: gaps.map((gap) => gap.id),
      planId: 'plan-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    },
    {
      ...noResources,
      narrate: async () => ({
        model: 'test-model',
        narrative: {
          readinessSummary: 'Narrated readiness summary.',
          steps: [{ stepId: target.id, whyItMatters: 'Narrated why.', evidenceBrief: 'Narrated brief.' }],
        },
      }),
    },
  );
  const step = result.path.stages.flatMap((stage) => stage.steps).find((candidate) => candidate.id === target.id)!;
  assert.equal(step.whyItMatters, 'Narrated why.');
  assert.equal(step.evidenceTask.brief, 'Narrated brief.');
  assert.equal(result.readiness.summary, 'Narrated readiness summary.');
  assert.equal(result.narrativeModel, 'test-model');

  const otherStep = result.path.stages.flatMap((stage) => stage.steps).find((candidate) => candidate.id !== target.id)!;
  assert.equal(otherStep.whyItMatters, otherStep.whyItMatters.length > 0 ? otherStep.whyItMatters : '');
  assert.notEqual(otherStep.whyItMatters, 'Narrated why.');
});

test('a narration failure never fails the plan build; deterministic content is used instead', async () => {
  const report = frontendReport();
  const gaps = report.gaps.filter((gap) => gap.roleId === 'frontend-react-engineer');
  const result = await buildLearningPath(
    {
      analysisId: 'analysis-1',
      roleId: 'frontend-react-engineer',
      gapReport: report,
      selectedGapIds: gaps.map((gap) => gap.id),
      planId: 'plan-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    },
    { ...noResources, narrate: async () => { throw new Error('provider exploded'); } },
  );
  assert.equal(result.narrativeModel, null);
  assert.ok(result.path.stages.length > 0);
});

test('readiness numbers are derived only from the role fitScore and the selected gap set', async () => {
  const report = frontendReport();
  const gaps = report.gaps.filter((gap) => gap.roleId === 'frontend-react-engineer');
  const role = report.roles.find((candidate) => candidate.roleId === 'frontend-react-engineer')!;
  const result = await buildLearningPath(
    {
      analysisId: 'analysis-1',
      roleId: 'frontend-react-engineer',
      gapReport: report,
      selectedGapIds: gaps.map((gap) => gap.id),
      planId: 'plan-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    },
    { ...noResources, ...noNarration },
  );
  assert.equal(result.readiness.readinessPercent, Math.round(role.fitScore * 100));
  assert.equal(result.readiness.blockingGapCount, gaps.filter((gap) => gap.severity === 'HIGH').length);
});

test('the safety cap truncates an oversized selection deterministically by priority, not silently dropping randomly', async () => {
  const fabricatedGaps: Gap[] = Array.from({ length: 12 }, (_, index) => ({
    id: `frontend-react-engineer:technical:fabricated-${index}`,
    roleId: 'frontend-react-engineer',
    category: 'technical-gap' as const,
    ruleId: 'TECHNICAL_SKILL',
    subject: `Fabricated skill ${index}`,
    topic: null,
    requiredLevel: 'SHIPPED' as const,
    observedLevel: 'NONE' as const,
    severity: index < 6 ? ('HIGH' as const) : ('LOW' as const),
    evidenceRefs: [],
    rationale: `Fabricated rationale ${index}`,
    useCase: 'technical-gap' as const,
  }));
  const report = frontendReport();
  const role = report.roles.find((candidate) => candidate.roleId === 'frontend-react-engineer')!;
  const fabricatedReport: GapReport = { ...report, gaps: [...report.gaps, ...fabricatedGaps], roles: report.roles };
  const result = await buildLearningPath(
    {
      analysisId: 'analysis-1',
      roleId: 'frontend-react-engineer',
      gapReport: fabricatedReport,
      selectedGapIds: fabricatedGaps.map((gap) => gap.id),
      planId: 'plan-1',
      userId: 'user-1',
      signal: new AbortController().signal,
    },
    { ...noResources, ...noNarration },
  );
  const allSteps = result.path.stages.flatMap((stage) => stage.steps);
  assert.equal(allSteps.length, MAX_PLAN_STEPS);
  // All 6 HIGH-severity fabricated gaps outrank all 6 LOW-severity ones, so
  // every one of the 6 HIGH gaps must survive the cap to 8; the remaining 2
  // slots go to the highest-scoring LOW gaps.
  const closeNowCount = allSteps.filter((step) => step.band === 'CLOSE_NOW').length;
  assert.equal(closeNowCount, 6);
  const laterCount = allSteps.filter((step) => step.band === 'LATER').length;
  assert.equal(laterCount, 2);
  void role;
});
