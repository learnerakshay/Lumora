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

// Regression for the production bug: a text-based PDF must still go through
// parseSourceContent -> resumeText -> extractProfileFromResumeText exactly
// as before this fix, completely unaffected by the new fallback branch.
test('a text-based PDF still follows the unchanged parse-to-text-extraction path', () => {
  assert.match(postProfileHandler, /const parsed = await parseSourceContent\(\{/);
  assert.match(postProfileHandler, /resumeText = parsed\.cleanText;/);
  assert.match(postProfileHandler, /await extractProfileFromResumeText\(\{ resumeText: resumeText! \}\)/);
});

// Regression for "PDF parsing failed: PDF contains no extractable text":
// only that exact failure signature may trigger the image-render fallback;
// every other PDF failure (corrupted, encrypted, oversized, wrong MIME)
// must still return RESUME_PDF_PARSE_FAILED immediately, unchanged.
test('only the exact "no extractable text" PDF failure triggers the image fallback; every other PDF failure still fails immediately', () => {
  assert.match(postProfileHandler, /if \(isEmptyExtractableTextFailure\(error\)\) \{/);
  assert.match(postProfileHandler, /pdfFallbackImages = await renderResumePdfPagesToImages\(file\.buffer\)/);
  assert.match(postProfileHandler, /if \(resumeText === null && \(!pdfFallbackImages \|\| pdfFallbackImages\.length === 0\)\) \{/);
  assert.match(postProfileHandler, /'RESUME_PDF_PARSE_FAILED'/);
});

// Regression for "never expose parser internals to the user": once both
// text extraction and the image fallback have failed, the response must use
// the existing stable, friendly resume-reading message — never the raw
// parser/render error text.
test('when both text extraction and the image fallback fail, the friendly stable message is shown, not raw parser internals', () => {
  assert.match(postProfileHandler, /isEmptyExtractableTextFailure\(error\)\s*\n\s*\? STABLE_UNREADABLE_RESUME_MESSAGE/);
});

// Regression for "fallback must not consume duplicate Skill Intelligence
// usage": there is exactly one reservation call in the whole handler, and it
// appears after the entire PDF parse/fallback block — so whichever of the
// three extraction paths (text, direct image, PDF-image-fallback) is taken,
// only one SKILL_INTELLIGENCE unit is ever reserved.
test('exactly one usage reservation exists in the handler, positioned after the PDF fallback block resolves', () => {
  const reservationMatches = postProfileHandler.match(/checkAndReserve\(userId, 'SKILL_INTELLIGENCE'\)/g) || [];
  assert.equal(reservationMatches.length, 1, 'expected exactly one SKILL_INTELLIGENCE reservation call site');
  const fallbackIndex = postProfileHandler.indexOf('renderResumePdfPagesToImages(file.buffer)');
  const reservationIndex = postProfileHandler.indexOf("checkAndReserve(userId, 'SKILL_INTELLIGENCE')");
  assert.ok(fallbackIndex >= 0 && reservationIndex > fallbackIndex);
});

// Regression for "do not introduce a separate OCR architecture": the
// fallback must reuse the existing image/vision extraction pipeline, keyed
// off the same bounded rendering helper, not a new unbounded loop.
test('the PDF fallback reuses the existing image extraction pipeline and the bounded rendering helper', () => {
  assert.match(postProfileHandler, /extractProfileFromResumeImages\(\{ images: pdfFallbackImages \}\)/);
  assert.match(routeSource, /from '\.\.\/lib\/skills\/resume-pdf-image-fallback'/);
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
