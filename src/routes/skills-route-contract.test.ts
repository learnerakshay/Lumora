import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(new URL('./skills.ts', import.meta.url), 'utf8');

function sliceHandler(startMarker: string, endMarker: string): string {
  const start = routeSource.indexOf(startMarker);
  assert.ok(start >= 0, `expected to find "${startMarker}" in skills.ts`);
  const end = routeSource.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `expected to find "${endMarker}" after "${startMarker}" in skills.ts`);
  return routeSource.slice(start, end);
}

const postProfileHandler = sliceHandler(
  "skillsRouter.post('/profile'",
  "skillsRouter.get('/profile'",
);
const postAnalysisHandler = sliceHandler(
  "skillsRouter.post('/analysis'",
  "skillsRouter.delete('/profile'",
);
const deleteProfileHandler = routeSource.slice(routeSource.indexOf("skillsRouter.delete('/profile'"));

test('POST /profile is the only Skill Intelligence route that calls the extraction provider and metering', () => {
  assert.match(postProfileHandler, /checkAndReserve\(userId, 'SKILL_INTELLIGENCE'\)/);
  assert.match(postProfileHandler, /await commitUsage\(usageEventId/);
  assert.match(postProfileHandler, /extractProfileFromResumeImage|extractProfileFromResumeText/);
});

// Regression for "Re-run analysis behaves like reset": the route must use
// only the stored extraction/normalizedSkills to recompute roles and gaps,
// never touch the provider, and never reserve or commit Skill Intelligence
// usage — re-analysis is free and instant by contract.
test('POST /analysis never calls the extraction provider and never reserves or commits usage', () => {
  assert.doesNotMatch(postAnalysisHandler, /extractProfileFromResumeImage|extractProfileFromResumeText/);
  assert.doesNotMatch(postAnalysisHandler, /checkAndReserve|commitUsage|discardUsage/);
  assert.match(postAnalysisHandler, /getLatestSkillProfile\(/);
  assert.match(postAnalysisHandler, /selectTargetRoles\(latest\.profile\.normalizedSkills\)/);
  assert.match(postAnalysisHandler, /analyzeSkillGaps\(latest\.profile\.extraction, latest\.profile\.normalizedSkills, roles\)/);
  assert.match(postAnalysisHandler, /createRoleAnalysis\(/);
});

// Regression for "Start over does not work correctly": deleting the profile
// must never touch usage metering either.
test('DELETE /profile only deletes the stored profile and never reserves or commits usage', () => {
  assert.match(deleteProfileHandler, /deleteSkillProfilesForUser\(res\.locals\.userId\)/);
  assert.doesNotMatch(deleteProfileHandler, /checkAndReserve|commitUsage|discardUsage/);
});
