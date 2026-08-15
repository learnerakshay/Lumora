export const RESOURCE_TOPICS = [
  'javascript',
  'typescript',
  'react',
  'react-native',
  'nextjs',
  'nodejs',
  'backend',
  'full-stack',
  'golang',
  'python',
  'cpp',
  'spring-boot',
  'postgresql',
  'authentication',
  'mobile-development',
  'generative-ai',
  'computer-networks',
  'recursion',
  'project-building',
  'docker',
  'system-design',
  'ai-agents',
  'aws',
  'serverless',
  'nginx',
  'open-source',
  'rust',
  'webrtc',
  'git-github',
  'developer-mindset',
  'dsa',
  'data-science',
  'operating-systems',
  'dbms',
  'kubernetes',
  'devops',
] as const;

export type Topic = (typeof RESOURCE_TOPICS)[number];

export const RESOURCE_USE_CASES = [
  'roadmap',
  'technical-gap',
  'project-proof',
  'interview-prep',
  'developer-mindset',
] as const;

export type UseCase = (typeof RESOURCE_USE_CASES)[number];
export type ResourceLanguage = 'hi' | 'en' | 'mixed';
export type ResourcePlatform = 'YouTube' | 'Udemy' | 'Cohort' | 'Website';
export type ResourceType = 'video' | 'playlist' | 'course' | 'cohort' | 'digital-product' | 'article' | 'docs';
export type ResourceLevel = 'beginner' | 'intermediate' | 'advanced';
export type ResourceAccessType = 'free' | 'paid';
export type ResourceLinkMode = 'DIRECT_RESOURCE' | 'PROVIDER_FALLBACK';
export type ResourceDeliveryMode = 'LIVE' | 'RECORDED';

export interface Creator {
  id: string;
  name: string;
  aliases?: string[];
}

export interface Organization {
  id: string;
  name: string;
  url: string;
}

export type ProviderOwner =
  | { creatorId: string; organizationId?: never }
  | { creatorId?: never; organizationId: string };

export type Provider = ProviderOwner & {
  id: string;
  name: string;
  platform: ResourcePlatform;
  // Optional because the owner supplied verified resources but no channel URL
  // for the Phase-1 Chai aur Code provider. Never synthesize provider URLs.
  url?: string;
  language?: ResourceLanguage;
};

export interface ResourceOffer {
  source: 'ChaiCode';
  url: string;
  verifiedAt: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface LearningResource {
  id: string;
  title: string;
  creatorId?: string;
  additionalCreatorIds?: string[];
  providerId: string;
  type: ResourceType;
  url: string;
  topics: Topic[];
  level: ResourceLevel;
  useCases: UseCase[];
  language?: ResourceLanguage;
  accessType: ResourceAccessType;
  status: 'ACTIVE' | 'ARCHIVED';
  verifiedAt: string;
  description: string;
  sourceOrigin: 'CURATED';
  seriesId?: string;
  linkMode?: ResourceLinkMode;
  deliveryMode?: ResourceDeliveryMode;
  canonicalUrl?: string;
  offer?: ResourceOffer;
  durationHours?: number;
}

export interface DiscoveredLearningResource
  extends Omit<LearningResource, 'sourceOrigin'> {
  sourceOrigin: 'DISCOVERED';
}

export interface RankingPreferenceRule {
  id: string;
  matchTopics?: Topic[];
  matchUseCases?: UseCase[];
  preferredCreatorIds: string[];
  boostStrength: 'NORMAL' | 'STRONG';
}

export interface ResolvedLearningResource {
  resource: LearningResource | DiscoveredLearningResource;
  creatorName: string;
  providerName: string;
  platform: ResourcePlatform;
  reason: string;
  score: number;
}

// Safe persisted/API contract. Provenance and ranking mechanics intentionally
// remain server-side and are never exposed by the chat response.
export interface LearningResourceRecommendation {
  id: string;
  title: string;
  creator: string;
  provider: string;
  platform: ResourcePlatform;
  type: ResourceType;
  url: string;
  reason: string;
  language?: ResourceLanguage;
  level: ResourceLevel;
  accessType: 'free' | 'paid';
  deliveryMode?: ResourceDeliveryMode;
  offer?: {
    url: string;
    label: string;
  };
}

export function toLearningResourceRecommendation(
  resolved: ResolvedLearningResource,
): LearningResourceRecommendation {
  const { resource } = resolved;
  return {
    id: resource.id,
    title: resource.title,
    creator: resolved.creatorName,
    provider: resolved.providerName,
    platform: resolved.platform,
    type: resource.type,
    url: resource.url,
    reason: resolved.reason,
    ...(resource.language ? { language: resource.language } : {}),
    level: resource.level,
    accessType: resource.accessType,
    ...(resource.deliveryMode ? { deliveryMode: resource.deliveryMode } : {}),
    ...(resource.offer?.status !== 'INACTIVE'
      ? resource.offer
        ? {
            offer: {
              url: resource.offer.url,
              label: 'Check current ChaiCode offer',
            },
          }
        : {}
      : {}),
  };
}
