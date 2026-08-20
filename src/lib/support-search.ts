export type SupportCategory =
  | 'WORKSPACES'
  | 'SOURCES'
  | 'CHAT'
  | 'SKILL INTELLIGENCE'
  | 'USAGE'
  | 'BILLING'
  | 'ACCOUNT'
  | 'SUPPORT'
  | 'LEGAL';

export interface SupportSearchEntry {
  id: string;
  category: SupportCategory;
  title: string;
  description: string;
  keywords: readonly string[];
  to: string;
}

// This index points to real Lumora routes and summarizes product behavior that
// already exists in the FAQ, pricing, usage, Workspace, and Career Intelligence
// surfaces. It is intentionally small enough to search locally.
export const SUPPORT_SEARCH_ENTRIES: readonly SupportSearchEntry[] = [
  {
    id: 'workspace-basics',
    category: 'WORKSPACES',
    title: 'Workspace basics',
    description: 'Collect sources on a topic and chat with them inside an account-isolated Workspace.',
    keywords: ['create workspace', 'workspace privacy', 'knowledge'],
    to: '/faq#faq-workspaces',
  },
  {
    id: 'add-sources',
    category: 'SOURCES',
    title: 'Add sources to a Workspace',
    description: 'Add PDFs, websites, YouTube videos, transcripts, plain text, or Markdown notes.',
    keywords: ['upload', 'ingestion', 'source types', 'vtt'],
    to: '/workspaces',
  },
  {
    id: 'pdf-ingestion',
    category: 'SOURCES',
    title: 'PDF source ingestion',
    description: 'Upload a PDF, wait for processing, then use it as evidence in Workspace chat.',
    keywords: ['pdf upload', 'document', 'pages', 'processing'],
    to: '/workspaces',
  },
  {
    id: 'youtube-ingestion',
    category: 'SOURCES',
    title: 'YouTube source ingestion',
    description: 'Add a supported YouTube video URL and use its processed transcript inside a Workspace.',
    keywords: ['video', 'transcript', 'captions', 'timestamp', 'youtube processing'],
    to: '/workspaces',
  },
  {
    id: 'website-text-sources',
    category: 'SOURCES',
    title: 'Website and text sources',
    description: 'Add a website URL, plain text, Markdown, or a VTT transcript to a Workspace.',
    keywords: ['web page', 'url', 'notes', 'text ingestion', 'vtt'],
    to: '/workspaces',
  },
  {
    id: 'source-processing-problem',
    category: 'SUPPORT',
    title: 'Slow or failed source processing',
    description: 'Report a repeatable PDF, website, text, or YouTube ingestion failure with the source type and steps.',
    keywords: ['ingestion error', 'processing failed', 'stuck', 'youtube', 'pdf'],
    to: '/report-bug',
  },
  {
    id: 'general-answers',
    category: 'CHAT',
    title: 'GENERAL responses',
    description: 'GENERAL answers use model knowledge when Workspace evidence does not cover the question.',
    keywords: ['chat mode', 'no citations', 'fallback', 'ungrounded'],
    to: '/faq#faq-chat',
  },
  {
    id: 'grounded-answers',
    category: 'CHAT',
    title: 'GROUNDED responses',
    description: 'GROUNDED answers are built from relevant Workspace evidence and include source citations.',
    keywords: ['chat mode', 'rag', 'retrieval', 'evidence', 'source backed'],
    to: '/faq#faq-chat',
  },
  {
    id: 'citations',
    category: 'CHAT',
    title: 'Citations and source evidence',
    description: 'Citations point to a PDF page, website section, or YouTube and transcript timestamp.',
    keywords: ['references', 'evidence', 'page number', 'youtube timestamp', 'grounded'],
    to: '/faq#faq-chat',
  },
  {
    id: 'skill-intelligence',
    category: 'SKILL INTELLIGENCE',
    title: 'Skill and Career Intelligence',
    description: 'Build an evidence-backed skill profile and compare it with target role requirements.',
    keywords: ['career intelligence', 'skills', 'role fit', 'gap analysis'],
    to: '/skills',
  },
  {
    id: 'resume-analysis',
    category: 'SKILL INTELLIGENCE',
    title: 'Resume analysis',
    description: 'Upload a resume or paste its text to extract skills, supporting evidence, and role-fit gaps.',
    keywords: ['cv', 'resume upload', 'skill extraction', 'career'],
    to: '/skills',
  },
  {
    id: 'learning-paths',
    category: 'SKILL INTELLIGENCE',
    title: 'Learning Paths',
    description: 'Select evidence-based skill gaps and build a staged plan for closing them.',
    keywords: ['learning plan', 'career readiness', 'gaps', 'learning workspace'],
    to: '/skills',
  },
  {
    id: 'usage-limits',
    category: 'USAGE',
    title: 'Usage limits and rolling windows',
    description: 'Lumora meters each action in a rolling 12-hour window and shows when capacity returns.',
    keywords: ['quota', '12 hour', 'twelve hour', 'reset', 'capacity', 'limits'],
    to: '/usage',
  },
  {
    id: 'plans',
    category: 'BILLING',
    title: 'FREE, CORE, and MAX plans',
    description: 'Compare plan capacity and Lumora\'s one-time 30-day access purchases.',
    keywords: ['pricing', 'upgrade', 'billing', 'limits', 'plan'],
    to: '/pricing',
  },
  {
    id: 'payments-billing',
    category: 'BILLING',
    title: 'Payments and billing',
    description: 'Review current access, payment status, and plan details on the Billing page.',
    keywords: ['razorpay', 'purchase', 'payment issue', 'renew', 'receipt'],
    to: '/billing',
  },
  {
    id: 'account-authentication',
    category: 'ACCOUNT',
    title: 'Account and authentication',
    description: 'Sign in to access your private Workspaces, usage, billing, and Career Intelligence data.',
    keywords: ['login', 'clerk', 'sign in', 'account access', 'authentication'],
    to: '/sign-in',
  },
  {
    id: 'bug-reporting',
    category: 'SUPPORT',
    title: 'Report a problem',
    description: 'Prepare a structured email report for broken features, citations, ingestion, or payments.',
    keywords: ['bug', 'error', 'broken', 'support', 'issue'],
    to: '/report-bug',
  },
  {
    id: 'faq',
    category: 'SUPPORT',
    title: 'Frequently asked questions',
    description: 'Read answers about Workspaces, chat modes, citations, Career Intelligence, plans, and privacy.',
    keywords: ['faq', 'help', 'questions', 'support'],
    to: '/faq',
  },
  {
    id: 'privacy',
    category: 'LEGAL',
    title: 'Privacy Policy',
    description: 'Review how Lumora processes Workspace, chat, resume, usage, and payment data.',
    keywords: ['data', 'security', 'private', 'policy'],
    to: '/privacy',
  },
  {
    id: 'terms',
    category: 'LEGAL',
    title: 'Terms of Use',
    description: 'Review Lumora terms, plan access, payments, and refund conditions.',
    keywords: ['legal', 'refunds', 'terms', 'conditions'],
    to: '/terms',
  },
] as const;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function searchSupportContent(query: string, limit = 6): SupportSearchEntry[] {
  const normalizedQuery = normalized(query);
  if (!normalizedQuery) return [];

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const scored = SUPPORT_SEARCH_ENTRIES.flatMap((entry, index) => {
    const title = normalized(entry.title);
    const description = normalized(entry.description);
    const category = normalized(entry.category);
    const keywords = entry.keywords.map(normalized);
    const searchable = [title, description, category, ...keywords].join(' ');

    if (!tokens.every((token) => searchable.includes(token))) return [];

    let score = title === normalizedQuery ? 120 : title.includes(normalizedQuery) ? 60 : 0;
    if (keywords.some((keyword) => keyword === normalizedQuery)) score += 45;
    if (searchable.includes(normalizedQuery)) score += 20;

    for (const token of tokens) {
      if (title.includes(token)) score += 18;
      if (category.includes(token)) score += 10;
      if (keywords.some((keyword) => keyword.includes(token))) score += 8;
      if (description.includes(token)) score += 4;
    }

    return [{ entry, score, index }];
  });

  return scored
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(0, limit))
    .map(({ entry }) => entry);
}
