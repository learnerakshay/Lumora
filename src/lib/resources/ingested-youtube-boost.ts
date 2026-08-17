import { extractTopics } from './normalization';
import type { LearningResourceRecommendation, ResourceLevel, Topic } from './domain';

const MAX_PROMOTED_INGESTED_SOURCES = 3;

// Explicit video/YouTube intent only — "playlist" and "series" are how
// Lumora's curated catalog already refers to YouTube content elsewhere in
// Resource Intelligence (see normalization.ts's extractPreferredResourceType),
// so this stays a narrow, additive gate rather than a new detector: it never
// fires for a plain "recommend a resource" ask, only an explicit video ask.
export function isYouTubeRecommendationQuery(query: string): boolean {
  return /\b(?:youtube|playlist|series|watch|video)\b/i.test(query);
}

export interface IngestedYouTubeCandidate {
  id: string;
  title: string;
  url: string | null;
}

function matchedTopicCount(source: IngestedYouTubeCandidate, topics: readonly Topic[]): number {
  if (topics.length === 0) return 0;
  const sourceTopics = extractTopics(source.title);
  return sourceTopics.filter((topic) => topics.includes(topic)).length;
}

function canonicalUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return `video:${parsed.pathname.replace(/^\//, '')}`;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const videoId = parsed.searchParams.get('v');
      if (videoId) return `video:${videoId}`;
      const listId = parsed.searchParams.get('list');
      if (listId) return `list:${listId}`;
    }
    return url.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function toIngestedRecommendation(
  source: IngestedYouTubeCandidate,
  level: ResourceLevel,
): LearningResourceRecommendation {
  return {
    id: `ingested-${source.id}`,
    title: source.title,
    creator: 'Already in this Workspace',
    provider: 'Your Workspace',
    platform: 'YouTube',
    type: 'video',
    url: source.url || '',
    reason: 'Already ingested in this Workspace — ask about it directly in chat.',
    level,
    accessType: 'free',
  };
}

export interface PromoteIngestedYouTubeSourcesInput {
  query: string;
  topics: readonly Topic[];
  level?: ResourceLevel;
  ingestedYouTubeSources: readonly IngestedYouTubeCandidate[];
  recommendations: readonly LearningResourceRecommendation[];
}

// The only ranking rule this adds: a genuinely topic-relevant, already-
// ingested Workspace YouTube source is promoted ahead of every external
// Resource Intelligence recommendation, deduplicated by canonical video/list
// id. Everything else about ranking, discovery, and the curated catalog is
// untouched — this only ever reorders/prepends, never filters or re-scores
// the existing `recommendations` list.
export function promoteIngestedYouTubeSources(
  input: PromoteIngestedYouTubeSourcesInput,
): LearningResourceRecommendation[] {
  if (!isYouTubeRecommendationQuery(input.query)) return [...input.recommendations];

  const relevant = input.ingestedYouTubeSources
    .filter((source): source is IngestedYouTubeCandidate & { url: string } => Boolean(source.url))
    .map((source) => ({ source, matches: matchedTopicCount(source, input.topics) }))
    .filter(({ matches }) => matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, MAX_PROMOTED_INGESTED_SOURCES)
    .map(({ source }) => source);

  if (relevant.length === 0) return [...input.recommendations];

  const promoted = relevant.map((source) => toIngestedRecommendation(source, input.level ?? 'beginner'));
  const promotedKeys = new Set(promoted.map((item) => canonicalUrlKey(item.url)));
  const deduped = input.recommendations.filter((item) => !promotedKeys.has(canonicalUrlKey(item.url)));
  return [...promoted, ...deduped];
}
