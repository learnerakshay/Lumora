import assert from 'node:assert/strict';
import test from 'node:test';
import { getLatestSkillProfile } from './skill-profile-store';

interface FakeRow {
  id: string;
  userId: string;
  version: number;
  status: 'EXTRACTING' | 'READY' | 'FAILED';
  sourceKind: string;
  sourceText: string | null;
  extraction: unknown;
  normalizedSkills: unknown;
  extractionModel: string | null;
  contractVersion: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  analyses: unknown[];
}

function row(overrides: Partial<FakeRow> & { id: string; version: number; status: FakeRow['status'] }): FakeRow {
  return {
    userId: 'user-1',
    sourceKind: 'TEXT',
    sourceText: 'resume text',
    extraction: overrides.status === 'READY' ? { skills: [] } : null,
    normalizedSkills: overrides.status === 'READY' ? [] : null,
    extractionModel: overrides.status === 'READY' ? 'gpt-5.6-sol' : null,
    contractVersion: 'v1',
    errorMessage: overrides.status === 'FAILED' ? 'extraction failed' : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    analyses: [],
    ...overrides,
  };
}

function fakeDatabase(rows: FakeRow[]) {
  return {
    skillProfile: {
      findFirst: async ({ where, orderBy }: any) => {
        const matches = rows.filter(
          (candidate) =>
            candidate.userId === where.userId &&
            (where.status === undefined || candidate.status === where.status),
        );
        if (matches.length === 0) return null;
        const sorted = [...matches].sort((a, b) =>
          orderBy?.version === 'desc' ? b.version - a.version : a.version - b.version,
        );
        return sorted[0];
      },
    },
  };
}

test('a FAILED re-run attempt does not permanently hide an earlier READY profile', async () => {
  // Regression: getLatestSkillProfile previously returned the absolute
  // highest-version row regardless of status. Once a re-run attempt failed
  // (version 2, FAILED), it became "latest" forever, and POST /analysis's
  // `status !== 'READY'` gate then permanently rejected every future re-run
  // attempt even though version 1 was successfully READY.
  const rows = [
    row({ id: 'p1', version: 1, status: 'READY' }),
    row({ id: 'p2', version: 2, status: 'FAILED' }),
  ];
  const result = await getLatestSkillProfile('user-1', fakeDatabase(rows) as any);
  assert.ok(result);
  assert.equal(result!.profile.id, 'p1');
  assert.equal(result!.profile.status, 'READY');
});

test('an in-progress EXTRACTING re-run does not hide the previous READY report mid-flight', async () => {
  // Regression: a concurrent page load/refresh while a re-run is in flight
  // (status EXTRACTING, no extraction/normalizedSkills populated yet) would
  // otherwise show a blank/broken report instead of the still-good prior one.
  const rows = [
    row({ id: 'p1', version: 1, status: 'READY' }),
    row({ id: 'p2', version: 2, status: 'EXTRACTING', extraction: null, normalizedSkills: null }),
  ];
  const result = await getLatestSkillProfile('user-1', fakeDatabase(rows) as any);
  assert.ok(result);
  assert.equal(result!.profile.id, 'p1');
  assert.equal(result!.profile.status, 'READY');
});

test('the true latest profile is returned when it is READY (the common, unaffected case)', async () => {
  const rows = [
    row({ id: 'p1', version: 1, status: 'READY' }),
    row({ id: 'p2', version: 2, status: 'READY' }),
  ];
  const result = await getLatestSkillProfile('user-1', fakeDatabase(rows) as any);
  assert.equal(result!.profile.id, 'p2');
});

test('a user with no READY profile yet still sees their latest EXTRACTING/FAILED attempt, unchanged', async () => {
  const rows = [row({ id: 'p1', version: 1, status: 'FAILED' })];
  const result = await getLatestSkillProfile('user-1', fakeDatabase(rows) as any);
  assert.ok(result);
  assert.equal(result!.profile.id, 'p1');
  assert.equal(result!.profile.status, 'FAILED');
});

test('no profile at all returns null', async () => {
  const result = await getLatestSkillProfile('user-1', fakeDatabase([]) as any);
  assert.equal(result, null);
});
