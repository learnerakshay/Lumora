import { logger } from '../logger';
import type { WebSource } from '../ai/types';
import {
  CURATED_LEARNING_RESOURCES,
  RESOURCE_CREATORS,
  RESOURCE_ORGANIZATIONS,
  RESOURCE_PREFERENCE_RULES,
  RESOURCE_PROVIDERS,
  canonicalResourceUrl,
} from './catalog';
import type {
  Creator,
  DiscoveredLearningResource,
  LearningResource,
  Organization,
  Provider,
  RankingPreferenceRule,
  ResolvedLearningResource,
  ResourceLanguage,
  ResourceLevel,
  ResourceAccessType,
  ResourceDeliveryMode,
  ResourcePlatform,
  ResourceType,
  Topic,
  UseCase,
} from './domain';
import {
  tavilyResourceDiscovery,
  type ResourceDiscoveryProvider,
} from './discovery';

export interface ResolveResourcesInput {
  query: string;
  topics: Topic[];
  useCase?: UseCase;
  level?: ResourceLevel;
  language?: ResourceLanguage;
  limit?: number;
  workspaceId: string;
  userId: string;
  signal?: AbortSignal;
  accessType?: ResourceAccessType;
  platform?: ResourcePlatform;
  resourceType?: ResourceType;
  deliveryMode?: ResourceDeliveryMode;
}

export interface ResourceResolverDependencies {
  discovery?: ResourceDiscoveryProvider;
  creators?: readonly Creator[];
  organizations?: readonly Organization[];
  providers?: readonly Provider[];
  resources?: readonly LearningResource[];
  preferenceRules?: readonly RankingPreferenceRule[];
  now?: () => Date;
}

interface RankedResource extends ResolvedLearningResource {
  topicMatches: number;
  useCaseMatch: boolean;
}

const discoveryCache = new Map<string, { expiresAt: number; results: WebSource[] }>();
const CACHE_TTL_MS = 10 * 60 * 1_000;
const MAX_CACHE_ENTRIES = 100;

function discoveryQuery(input: ResolveResourcesInput): string {
  const topic = (input.topics.length > 0 ? input.topics.join(' ') : input.query)
    .toLowerCase()
    .replace(/[^a-z0-9+#. -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const useCase = input.useCase === 'project-proof'
    ? 'hands-on project course'
    : input.useCase === 'interview-prep'
      ? 'interview preparation course'
      : 'course playlist learning resources';
  const language = input.language === 'hi' ? 'Hindi' : input.language === 'en' ? 'English' : '';
  const preference = [input.accessType, input.platform, input.resourceType, input.deliveryMode]
    .filter(Boolean)
    .join(' ');
  return `${topic.slice(0, 220)} ${useCase} ${language} ${preference}`.replace(/\s+/g, ' ').trim();
}

function cacheKey(input: ResolveResourcesInput): string {
  return [
    [...input.topics].sort().join(','),
    input.useCase || '',
    input.level || '',
    input.language || '',
    input.accessType || '',
    input.platform || '',
    input.resourceType || '',
    input.deliveryMode || '',
    input.topics.length === 0 ? input.query.toLowerCase().replace(/\s+/g, ' ').trim() : '',
  ].join('|');
}

async function discover(
  input: ResolveResourcesInput,
  provider: ResourceDiscoveryProvider,
  now: () => Date,
): Promise<WebSource[]> {
  const key = cacheKey(input);
  const cached = discoveryCache.get(key);
  const timestamp = now().getTime();
  if (cached && cached.expiresAt > timestamp) return cached.results;
  const results = await provider.discover({
    query: discoveryQuery(input),
    workspaceId: input.workspaceId,
    userId: input.userId,
    signal: input.signal || new AbortController().signal,
    limit: 7,
  });
  if (discoveryCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = discoveryCache.keys().next().value as string | undefined;
    if (oldest) discoveryCache.delete(oldest);
  }
  discoveryCache.set(key, { expiresAt: timestamp + CACHE_TTL_MS, results });
  return results;
}

function inferredPlatform(url: URL): ResourcePlatform {
  return ['youtube.com', 'www.youtube.com', 'youtu.be'].includes(url.hostname.toLowerCase())
    ? 'YouTube'
    : 'Website';
}

function inferredType(source: WebSource, platform: ResourcePlatform): ResourceType {
  const value = `${source.title} ${source.url}`.toLowerCase();
  if (/\b(?:\d+|top)\s+(?:best\s+)?(?:books?|courses?|resources?|tutorials?)\b|\bbest\s+(?:books?|courses?|resources?|tutorials?)\b/.test(value)) {
    return 'article';
  }
  if (value.includes('playlist')) return 'playlist';
  if (value.includes('docs') || value.includes('documentation')) return 'docs';
  if (value.includes('course')) return 'course';
  if (platform === 'YouTube') return 'video';
  return 'article';
}

export function discoveredQualityBoost(
  source: WebSource,
  platform: ResourcePlatform,
  type: ResourceType,
  useCase?: UseCase,
): number {
  let url: URL;
  try {
    url = new URL(source.url);
  } catch {
    return -10;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.toLowerCase();
  const text = `${source.title} ${source.snippet}`.toLowerCase();
  const listicle = /\b(?:\d+|top)\s+(?:best\s+)?(?:books?|courses?|resources?|tutorials?)\b|\bbest\s+(?:books?|courses?|resources?|tutorials?)\b/.test(text);
  const aggregator = /(?:^|\.)(?:classcentral\.com|sitepoint\.com)$/.test(host) ||
    /\b(?:course catalog|course directory|learning resources directory)\b/.test(text);
  const officialOrTutorial = /\b(?:official|documentation|tutorial|learn)\b/.test(text) ||
    /\/(?:docs?|learn|tutorials?)(?:\/|$)/.test(path);
  const genericLibraryPage = useCase === 'roadmap' &&
    /\b(?:component library|design system|ui components?)\b/.test(text);
  const directPath = /\/(?:course|learn|tutorials?|docs?)(?:\/|$)/.test(path);

  return (platform === 'YouTube' ? 3 : 0) +
    (['playlist', 'video', 'course'].includes(type) ? 1.5 : 0) +
    (officialOrTutorial ? 2 : 0) +
    (directPath ? 1 : 0) -
    (listicle ? 5 : 0) -
    (aggregator ? 2 : 0) -
    (genericLibraryPage ? 2 : 0);
}

function isRecommendableDiscoveredUrl(url: URL, platform: ResourcePlatform): boolean {
  if (platform !== 'YouTube') return url.pathname.length > 1;
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be') return url.pathname.length > 1;
  if (url.pathname === '/watch') return Boolean(url.searchParams.get('v'));
  if (url.pathname === '/playlist') return Boolean(url.searchParams.get('list'));
  return /^\/(?:shorts|live)\/[^/]+/.test(url.pathname);
}

function stableDiscoveredId(url: string): string {
  let hash = 2166136261;
  for (const character of url) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `discovered-${(hash >>> 0).toString(36)}`;
}

export function normalizeDiscoveredResource(
  source: WebSource,
  input: ResolveResourcesInput,
  now: Date,
): { resource: DiscoveredLearningResource; creatorName: string; providerName: string; platform: ResourcePlatform } | null {
  let url: URL;
  try {
    url = new URL(source.url);
    if (
      url.protocol !== 'https:' ||
      !source.title.trim() ||
      !source.snippet.trim() ||
      !Number.isFinite(source.score) ||
      source.score < 0 ||
      source.score > 1
    ) return null;
  } catch {
    return null;
  }
  const providerName = url.hostname.toLowerCase().replace(/^www\./, '');
  const platform = inferredPlatform(url);
  if (!isRecommendableDiscoveredUrl(url, platform)) return null;
  const resource: DiscoveredLearningResource = {
    id: stableDiscoveredId(source.url),
    title: source.title.trim().slice(0, 300),
    creatorId: `discovered-${providerName}`,
    providerId: `discovered-${providerName}`,
    type: inferredType(source, platform),
    // Retain the exact validated provider-result URL. Canonicalization is only
    // used as a comparison key later.
    url: source.url,
    topics: [...input.topics],
    level: input.level || 'beginner',
    useCases: input.useCase ? [input.useCase] : ['roadmap'],
    ...(input.language ? { language: input.language } : {}),
    accessType: 'free',
    status: 'ACTIVE',
    verifiedAt: now.toISOString(),
    description: source.snippet.trim().slice(0, 500),
    sourceOrigin: 'DISCOVERED',
  };
  return { resource, creatorName: 'Independent source', providerName, platform };
}

function preferenceBoost(
  resource: LearningResource | DiscoveredLearningResource,
  input: ResolveResourcesInput,
  rules: readonly RankingPreferenceRule[],
): number {
  let boost = 0;
  for (const rule of rules) {
    const topicMatch = !rule.matchTopics?.length || rule.matchTopics.some((topic) => input.topics.includes(topic));
    const useCaseMatch = !rule.matchUseCases?.length || Boolean(input.useCase && rule.matchUseCases.includes(input.useCase));
    const creatorIds = [resource.creatorId, ...(resource.additionalCreatorIds || [])]
      .filter((id): id is string => Boolean(id));
    if (topicMatch && useCaseMatch && creatorIds.some((id) => rule.preferredCreatorIds.includes(id))) {
      boost += rule.boostStrength === 'STRONG' ? 8 : 3;
    }
  }
  return boost;
}

function relevanceReason(
  resource: LearningResource | DiscoveredLearningResource,
  input: ResolveResourcesInput,
): string {
  if (resource.sourceOrigin === 'CURATED') return resource.description;
  const matchedTopic = input.topics.find((topic) => resource.topics.includes(topic));
  const topic = matchedTopic ? matchedTopic.replace(/-/g, ' ') : 'your topic';
  if (input.language && resource.language === input.language) {
    return `${input.language === 'hi' ? 'Hindi' : 'English'} ${resource.type} matched to your learning goal.`;
  }
  if (input.useCase === 'project-proof' && resource.useCases.includes('project-proof')) {
    return 'A hands-on project match for applying what you know.';
  }
  if (input.resourceType === 'cohort' && resource.type === 'cohort') {
    return resource.deliveryMode === 'LIVE'
      ? 'A live cohort matched to the topic you want to learn.'
      : 'A structured recorded cohort matched to your learning goal.';
  }
  if (input.platform === 'Udemy' && resource.providerId === 'chaicode-udemy') {
    return 'A structured Udemy course matched to your learning goal.';
  }
  if (resource.type === 'playlist' || resource.type === 'course') {
    return `A direct ${resource.type} matched to your ${topic} learning goal.`;
  }
  if (resource.type === 'docs') return `Documentation matched to your ${topic} learning goal.`;
  return `An external learning guide relevant to ${topic}.`;
}

function rankCandidate(
  details: Omit<ResolvedLearningResource, 'score' | 'reason'>,
  input: ResolveResourcesInput,
  rules: readonly RankingPreferenceRule[],
  providerScore = 0,
): RankedResource {
  const { resource } = details;
  const topicMatches = input.topics.filter((topic) => resource.topics.includes(topic)).length;
  const useCaseMatch = Boolean(input.useCase && resource.useCases.includes(input.useCase));
  const languageMatch = Boolean(input.language && resource.language === input.language);
  const levelMatch = Boolean(input.level && resource.level === input.level);
  const foundationalFormat = input.useCase === 'roadmap' && ['playlist', 'course'].includes(resource.type);
  const accessMatch = Boolean(input.accessType && resource.accessType === input.accessType);
  const platformMatch = Boolean(input.platform && details.platform === input.platform);
  const typeMatch = Boolean(input.resourceType && resource.type === input.resourceType);
  const deliveryMatch = Boolean(input.deliveryMode && resource.deliveryMode === input.deliveryMode);
  const topicSpecificity = resource.topics.length > 0
    ? topicMatches / resource.topics.length
    : 0;
  const score = topicMatches * 5 +
    (useCaseMatch ? 3 : 0) +
    (languageMatch ? 2.5 : 0) +
    (levelMatch ? 1 : 0) +
    (foundationalFormat ? 1.25 : 0) +
    (accessMatch ? 3 : 0) +
    (platformMatch ? 3 : 0) +
    (typeMatch ? 3 : 0) +
    (deliveryMatch ? 2 : 0) +
    topicSpecificity * 2 +
    preferenceBoost(resource, input, rules) +
    providerScore;
  return {
    ...details,
    reason: relevanceReason(resource, input),
    score,
    topicMatches,
    useCaseMatch,
  };
}

function titleKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function deduplicate(resources: RankedResource[]): RankedResource[] {
  const byUrl = new Map<string, RankedResource>();
  const titles = new Set<string>();
  const series = new Set<string>();
  for (const candidate of resources.sort((a, b) => b.score - a.score)) {
    let key: string;
    try {
      key = candidate.resource.linkMode === 'PROVIDER_FALLBACK'
        ? `provider-fallback:${candidate.resource.id}`
        : canonicalResourceUrl(candidate.resource.url);
    } catch {
      continue;
    }
    const existing = byUrl.get(key);
    if (existing) {
      if (existing.resource.sourceOrigin === 'DISCOVERED' && candidate.resource.sourceOrigin === 'CURATED') {
        byUrl.set(key, candidate);
      }
      continue;
    }
    if (candidate.resource.seriesId && series.has(candidate.resource.seriesId)) continue;
    const normalizedTitle = titleKey(candidate.resource.title);
    if (normalizedTitle.length > 12 && titles.has(normalizedTitle)) continue;
    byUrl.set(key, candidate);
    titles.add(normalizedTitle);
    if (candidate.resource.seriesId) series.add(candidate.resource.seriesId);
  }
  return [...byUrl.values()];
}

function composeSoftly(resources: RankedResource[], limit: number): RankedResource[] {
  const sorted = [...resources].sort((a, b) => b.score - a.score);
  const hasCurated = sorted.some(({ resource }) => resource.sourceOrigin === 'CURATED');
  const hasDiscovered = sorted.some(({ resource }) => resource.sourceOrigin === 'DISCOVERED');
  if (!hasDiscovered) return sorted.slice(0, limit);
  if (!hasCurated) {
    const providerSeen = new Map<string, number>();
    return sorted
      .map((candidate) => {
        const providerCount = providerSeen.get(candidate.providerName) || 0;
        providerSeen.set(candidate.providerName, providerCount + 1);
        return { candidate, adjustedScore: candidate.score - providerCount * 1.25 };
      })
      .sort((a, b) => b.adjustedScore - a.adjustedScore)
      .slice(0, limit)
      .map(({ candidate }) => candidate);
  }

  let curatedSeen = 0;
  const providerSeen = new Map<string, number>();
  const composed = sorted
    .map((candidate) => {
      const diversityPenalty = candidate.resource.sourceOrigin === 'CURATED'
        ? Math.max(0, curatedSeen++) * 2.25
        : 0;
      const providerCount = providerSeen.get(candidate.providerName) || 0;
      providerSeen.set(candidate.providerName, providerCount + 1);
      return {
        candidate,
        adjustedScore: candidate.score - diversityPenalty - providerCount * 1.25,
      };
    })
    .sort((a, b) => b.adjustedScore - a.adjustedScore)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
  if (!composed.some(({ resource }) => resource.sourceOrigin === 'CURATED')) {
    const bestCurated = sorted.find(({ resource }) => resource.sourceOrigin === 'CURATED');
    const weakestSelected = composed.at(-1);
    // A genuine curated match may occupy one slot when it remains close to the
    // selected relevance band. This is a soft diversity nudge, never a quota.
    if (bestCurated && weakestSelected && bestCurated.score >= weakestSelected.score - 3) {
      composed[composed.length - 1] = bestCurated;
      composed.sort((a, b) => b.score - a.score);
    }
  }
  return composed;
}

export async function resolveResources(
  input: ResolveResourcesInput,
  dependencies: ResourceResolverDependencies = {},
): Promise<ResolvedLearningResource[]> {
  const limit = Math.max(3, Math.min(5, input.limit || 4));
  const creators = dependencies.creators || RESOURCE_CREATORS;
  const organizations = dependencies.organizations || RESOURCE_ORGANIZATIONS;
  const providers = dependencies.providers || RESOURCE_PROVIDERS;
  const resources = dependencies.resources || CURATED_LEARNING_RESOURCES;
  const rules = dependencies.preferenceRules || RESOURCE_PREFERENCE_RULES;
  const now = dependencies.now || (() => new Date());
  const discoveryProvider = dependencies.discovery || tavilyResourceDiscovery;

  const curated = resources
    .filter((resource) => resource.status === 'ACTIVE')
    .filter((resource) => input.accessType !== 'free' || resource.accessType === 'free')
    .filter((resource) => input.topics.length > 0 && resource.topics.some((topic) => input.topics.includes(topic)))
    .map((resource) => {
      const provider = providers.find(({ id }) => id === resource.providerId);
      if (!provider) return null;
      const creatorIds = [resource.creatorId, ...(resource.additionalCreatorIds || [])]
        .filter((id): id is string => Boolean(id));
      const creatorNames = creatorIds
        .map((id) => creators.find((creator) => creator.id === id)?.name)
        .filter((name): name is string => Boolean(name));
      const organizationName = provider.organizationId
        ? organizations.find(({ id }) => id === provider.organizationId)?.name
        : undefined;
      const ownerName = provider.creatorId
        ? creators.find(({ id }) => id === provider.creatorId)?.name
        : organizationName;
      const creatorName = creatorNames.length > 0 ? creatorNames.join(' + ') : ownerName;
      if (!creatorName) return null;
      return rankCandidate(
        {
          resource,
          creatorName,
          providerName: provider.name,
          platform: provider.platform,
        },
        input,
        rules,
      );
    })
    .filter((resource): resource is RankedResource => Boolean(resource));

  let discoveredSources: WebSource[] = [];
  try {
    discoveredSources = await discover(input, discoveryProvider, now);
  } catch (error) {
    logger.warn('Learning resource discovery failed closed', {
      workspaceId: input.workspaceId,
      topicCount: input.topics.length,
      reason: error instanceof Error ? error.name : 'unknown',
    });
  }
  const discovered = discoveredSources
    .map((source) => {
      const normalized = normalizeDiscoveredResource(source, input, now());
      if (!normalized) return null;
      return rankCandidate(
        normalized,
        input,
        rules,
        Math.max(0, Math.min(1, source.score)) * 2 +
          discoveredQualityBoost(source, normalized.platform, normalized.resource.type, input.useCase),
      );
    })
    .filter((resource): resource is RankedResource => Boolean(resource));

  return composeSoftly(deduplicate([...curated, ...discovered]), limit);
}

export function clearResourceDiscoveryCache(): void {
  discoveryCache.clear();
}
