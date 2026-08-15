import type {
  ResourceAccessType,
  ResourceDeliveryMode,
  ResourceLanguage,
  ResourceLevel,
  ResourcePlatform,
  ResourceType,
  Topic,
  UseCase,
} from './domain';

const TOPIC_ALIASES: ReadonlyArray<readonly [string, Topic]> = [
  ['data structures and algorithms', 'dsa'],
  ['database management system', 'dbms'],
  ['database management systems', 'dbms'],
  ['operating systems', 'operating-systems'],
  ['operating system', 'operating-systems'],
  ['data science', 'data-science'],
  ['openai agent sdk', 'ai-agents'],
  ['amazon web services', 'aws'],
  ['open source contribution', 'open-source'],
  ['open source contributions', 'open-source'],
  ['developer mindset', 'developer-mindset'],
  ['development niche', 'developer-mindset'],
  ['tutorial only developer', 'developer-mindset'],
  ['tutorial-only developer', 'developer-mindset'],
  ['tutorial dependent', 'developer-mindset'],
  ['tutorial-dependent', 'developer-mindset'],
  ['system design', 'system-design'],
  ['agentic ai', 'ai-agents'],
  ['ai agents', 'ai-agents'],
  ['ai agent', 'ai-agents'],
  ['git and github', 'git-github'],
  ['computer networking', 'computer-networks'],
  ['networking fundamentals', 'computer-networks'],
  ['computer networks', 'computer-networks'],
  ['computer network', 'computer-networks'],
  ['react native', 'react-native'],
  ['mobile development', 'mobile-development'],
  ['project building', 'project-building'],
  ['projects', 'project-building'],
  ['project', 'project-building'],
  ['generative ai', 'generative-ai'],
  ['genai', 'generative-ai'],
  ['spring boot', 'spring-boot'],
  ['springboot', 'spring-boot'],
  ['full stack', 'full-stack'],
  ['fullstack', 'full-stack'],
  ['react.js', 'react'],
  ['next.js', 'nextjs'],
  ['node.js', 'nodejs'],
  ['typescript', 'typescript'],
  ['javascript', 'javascript'],
  ['postgresql', 'postgresql'],
  ['serverless', 'serverless'],
  ['kubernetes', 'kubernetes'],
  ['devops', 'devops'],
  ['dbms', 'dbms'],
  ['dsa', 'dsa'],
  ['opensource', 'open-source'],
  ['open source', 'open-source'],
  ['docker', 'docker'],
  ['nginx', 'nginx'],
  ['webrtc', 'webrtc'],
  ['github', 'git-github'],
  ['rust', 'rust'],
  ['aws', 'aws'],
  ['k8s', 'kubernetes'],
  ['os', 'operating-systems'],
  ['authentication', 'authentication'],
  ['backend', 'backend'],
  ['golang', 'golang'],
  ['recursion', 'recursion'],
  ['python', 'python'],
  ['react', 'react'],
  ['nextjs', 'nextjs'],
  ['nodejs', 'nodejs'],
  ['postgres', 'postgresql'],
  ['c++', 'cpp'],
  ['cpp', 'cpp'],
  ['js', 'javascript'],
  ['next', 'nextjs'],
  ['node', 'nodejs'],
  ['go', 'golang'],
  ['cn', 'computer-networks'],
  ['git', 'git-github'],
];

function escapedPattern(value: string): RegExp {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  if (value === 'js') return new RegExp(`(^|[^a-z0-9+.])${escaped}(?=$|[^a-z0-9+])`, 'i');
  return new RegExp(`(^|[^a-z0-9+])${escaped}(?=$|[^a-z0-9+])`, 'i');
}

export function normalizeTopic(value: string): Topic | null {
  const normalized = value.toLowerCase().trim().replace(/\s+/g, ' ');
  return TOPIC_ALIASES.find(([alias]) => alias === normalized)?.[1] || null;
}

export function extractTopics(value: string): Topic[] {
  const topics: Topic[] = [];
  for (const [alias, topic] of TOPIC_ALIASES) {
    const compoundAlreadyMatched = topic === 'react' && topics.includes('react-native') &&
      !/\breact\b(?!\s+native)/i.test(value);
    if (!compoundAlreadyMatched && !topics.includes(topic) && escapedPattern(alias).test(value)) topics.push(topic);
  }
  return topics;
}

export function extractUseCase(value: string): UseCase | undefined {
  const normalized = value.toLowerCase();
  if (/\b(projects?|build|portfolio|hands?[- ]on|proof)\b|\bprove\b.{0,30}\bskills?\b/.test(normalized)) return 'project-proof';
  if (/\b(interviews?|job preparation|placement)\b/.test(normalized)) return 'interview-prep';
  if (/\b(gap|catch up|improve|struggling|deployment|containerisation|containerization)\b/.test(normalized)) return 'technical-gap';
  if (/\b(mindset|career habits?|developer habits?|development niche|tutorial[- ](?:only|dependent))\b/.test(normalized)) return 'developer-mindset';
  if (/\b(roadmap|learn|learning|study|start|beginner|course|cohort|playlist|resources?)\b/.test(normalized)) {
    return 'roadmap';
  }
  return undefined;
}

export function extractLevel(value: string): ResourceLevel | undefined {
  const normalized = value.toLowerCase();
  if (/\b(advanced|already know (?:the )?basics?|know .* basics?|beyond basics?|production[- ]style)\b/.test(normalized)) {
    return 'advanced';
  }
  if (/\b(beginner|new to|from scratch|where should i start|fundamentals?)\b/.test(normalized)) {
    return 'beginner';
  }
  return undefined;
}

export function extractLanguage(value: string): ResourceLanguage | undefined {
  if (/\b(hindi|हिन्दी|हिंदी)\b/i.test(value)) return 'hi';
  if (/\benglish\b/i.test(value)) return 'en';
  return undefined;
}

export function extractAccessType(value: string): ResourceAccessType | undefined {
  if (/\b(?:only\s+)?free\b|\bno[- ]cost\b/i.test(value)) return 'free';
  if (/\bpaid\b|\bpremium\b/i.test(value)) return 'paid';
  return undefined;
}

export function extractPreferredPlatform(value: string): ResourcePlatform | undefined {
  if (/\budemy\b/i.test(value)) return 'Udemy';
  return undefined;
}

export function extractPreferredResourceType(value: string): ResourceType | undefined {
  if (/\bcohorts?\b/i.test(value)) return 'cohort';
  if (/\budemy\b/i.test(value)) return 'course';
  return undefined;
}

export function extractDeliveryMode(value: string): ResourceDeliveryMode | undefined {
  if (/\blive\b.{0,50}\bcohorts?\b|\bcohorts?\b.{0,50}\blive\b/i.test(value)) return 'LIVE';
  return undefined;
}

export function hasLearningResourceIntent(value: string): boolean {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return [
    /\b(?:i\s+)?(?:want|need|trying|plan|planning)\s+to\s+learn\b/,
    /\bwhere\s+should\s+i\s+(?:learn|study)\b/,
    /\b(?:recommend|suggest)\b.{0,80}\b(?:resource|course|playlist|video|tutorial|roadmap|project)\b/,
    /\b(?:best|good)\b.{0,60}\b(?:course|playlist|resource|tutorial|video)\b/,
    /\b(?:best|good)\b.{0,60}\bcohorts?\b/,
    /\b(?:roadmap|resources?|course|playlist)\b.{0,80}\b(?:learn|learning|study|begin|start|recommend)\b/,
    /\b(?:learn|learning|study)\b.{0,80}\b(?:roadmap|resources?|course|playlist|project|from)\b/,
    /\b(?:give|show)\s+me\b.{0,80}\b(?:roadmap|resources?|course|playlist|project)\b/,
    /\bwhat\s+should\s+i\s+learn\s+first\b/,
    /\b(?:develop|build|choose|improve|stop being)\b.{0,80}\b(?:developer mindset|development niche|tutorial[- ](?:only|dependent))\b/,
    /\b(?:serious|production[- ]style|resume)\b.{0,60}\bprojects?\b|\bprojects?\b.{0,60}\b(?:resume|prove .*skills?)\b/,
    /\bhow\s+(?:can|do)\s+i\s+prove\b.{0,50}\bskills?\b/,
    /\b(?:teach|guide)\s+me\b.{0,80}\bfrom scratch\b/,
    /\b(?:new to|beginner in)\b.{0,60}\bwhere should i start\b/,
    /\b(?:want|need)\b.{0,80}\b(?:deployment|containerisation|containerization)\b.{0,40}\bproperly\b/,
    /\b(?:want|need)\b.{0,100}\bresources?\b/,
    /\b(?:is|are)\s+there\b.{0,80}\bcohorts?\b/,
    /\b(?:want|need)\b.{0,80}\bcohorts?\b/,
  ].some((pattern) => pattern.test(normalized));
}

export interface DetectedResourceIntent {
  query: string;
  topics: Topic[];
  useCase?: UseCase;
  language?: ResourceLanguage;
  level?: ResourceLevel;
  accessType?: ResourceAccessType;
  platform?: ResourcePlatform;
  resourceType?: ResourceType;
  deliveryMode?: ResourceDeliveryMode;
}

export function detectResourceIntent(value: string): DetectedResourceIntent | null {
  if (!hasLearningResourceIntent(value)) return null;
  const useCase = extractUseCase(value);
  const language = extractLanguage(value);
  const level = extractLevel(value);
  const accessType = extractAccessType(value);
  const platform = extractPreferredPlatform(value);
  const resourceType = extractPreferredResourceType(value);
  const deliveryMode = extractDeliveryMode(value);
  return {
    query: value.trim(),
    topics: extractTopics(value),
    ...(useCase ? { useCase } : {}),
    ...(language ? { language } : {}),
    ...(level ? { level } : {}),
    ...(accessType ? { accessType } : {}),
    ...(platform ? { platform } : {}),
    ...(resourceType ? { resourceType } : {}),
    ...(deliveryMode ? { deliveryMode } : {}),
  };
}

export const DOCUMENTED_TOPIC_ALIASES: Readonly<Record<string, Topic>> = {
  js: 'javascript',
  'react.js': 'react',
  'react native': 'react-native',
  next: 'nextjs',
  'next.js': 'nextjs',
  node: 'nodejs',
  'node.js': 'nodejs',
  postgres: 'postgresql',
  golang: 'golang',
  go: 'golang',
  springboot: 'spring-boot',
  'spring boot': 'spring-boot',
  cn: 'computer-networks',
  'computer networking': 'computer-networks',
  'networking fundamentals': 'computer-networks',
  'c++': 'cpp',
  'agentic ai': 'ai-agents',
  'ai agent': 'ai-agents',
  'ai agents': 'ai-agents',
  'openai agent sdk': 'ai-agents',
  'amazon web services': 'aws',
  git: 'git-github',
  github: 'git-github',
  'open source contribution': 'open-source',
  opensource: 'open-source',
  genai: 'generative-ai',
  'operating systems': 'operating-systems',
  os: 'operating-systems',
  'database management system': 'dbms',
  dbms: 'dbms',
  'data structures and algorithms': 'dsa',
  dsa: 'dsa',
  'data science': 'data-science',
  kubernetes: 'kubernetes',
  k8s: 'kubernetes',
  devops: 'devops',
};
