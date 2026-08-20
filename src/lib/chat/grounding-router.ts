import type { ChatResponseMode } from '../../types';

export interface AnswerabilityEvidence {
  content: string;
  sourceTitle: string;
}

export interface EvidenceSufficiencyAssessment {
  sufficient: boolean;
  reason:
    | 'no_context'
    | 'semantic_only_query'
    | 'complete_topic_coverage'
    | 'missing_topic_coverage';
  topicGroupCount: number;
  coveredTopicGroupCount: number;
}

interface GroundedHistoryMessage {
  id: string;
  parentMessageId: string | null;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  status: 'SENDING' | 'SUCCESS' | 'ERROR';
  responseMode: ChatResponseMode | null;
  citations?: unknown[];
}

export const NO_SOURCES_META_RESPONSE =
  "There are currently no sources in this Workspace. Add a PDF, website, YouTube video, or text note when you'd like answers grounded in your own material.";

export const GENERAL_FALLBACK_PREAMBLE =
  "This Workspace doesn't contain enough material covering that, so here's a general answer:\n\n";

const POSSESSIVE_SOURCE_REFERENCE =
  /\b(?:my|the)\s+(?:uploaded\s+)?(?:uploads?|sources?|documents?|docs?|notes?|files?|materials?)\b/i;
const WORKSPACE_REFERENCE =
  /\b(?:this|my|the|current)\s+workspace\b|\bworkspace\s+(?:contents?|sources?|documents?|notes?|information|materials?)\b/i;
const CONTENT_INTENT =
  /\b(?:what|which|list|show|summari[sz]e|describe|tell|information|contents?|anything)\b/i;
const UPLOAD_INTENT =
  /\bwhat\s+(?:did|have)\s+i\s+upload(?:ed)?\b|\bwhat(?:'s|\s+is)\s+(?:been\s+)?uploaded\b/i;
const SOURCE_CONTENT_INTENT =
  /\bwhat(?:'s|\s+is|\s+are)\s+(?:in|inside|contained\s+in)\s+(?:my|the|this)\s+(?:sources?|documents?|docs?|notes?|files?|workspace)\b/i;

const QUERY_SCAFFOLDING = new Set([
  'a', 'about', 'according', 'an', 'answer', 'answers', 'are', 'as', 'at', 'be',
  'become', 'beginner', 'best', 'between', 'build', 'can', 'compare', 'concept',
  'was', 'were',
  'concepts', 'content', 'contents', 'could', 'create', 'describe', 'did',
  'difference', 'differences', 'discuss', 'discussed', 'discusses', 'discussing',
  'do', 'does',
  'document', 'documents', 'engineering', 'engineer', 'example', 'examples',
  'explain', 'file', 'files', 'for', 'from', 'give', 'guide', 'have', 'help',
  'how', 'i', 'in', 'information', 'inside', 'interview', 'into', 'is', 'it',
  'important', 'its', 'key', 'learn', 'learning', 'main', 'make', 'material',
  'materials',
  'me', 'most', 'my', 'note', 'notes', 'of', 'on', 'one', 'ones', 'overview',
  'pdf', 'pdfs', 'plan', 'please', 'pros',
  'implement', 'question', 'questions', 'roadmap', 'say', 'said', 'should',
  'show', 'source',
  'sources', 'speaker', 'speakers', 'step', 'steps', 'suggest', 'suggested',
  'suggests', 'summarize', 'summary', 'takeaway', 'takeaways',
  'tell', 'that', 'the', 'their', 'these', 'this', 'to', 'topic', 'topics',
  'understand', 'uploaded',
  'upload', 'use', 'using', 'versus', 'want', 'what', 'when', 'where', 'which',
  'video', 'videos', 'website', 'websites', 'why', 'with', 'work', 'works',
  'workspace', 'would', 'youtube', 'you', 'your',
  // Ordinal/duration references locate WHERE in a source to look ("the
  // first 2 minutes"), not WHAT topic to require evidence for.
  'first', 'second', 'seconds', 'minute', 'minutes', 'hour', 'hours',
  // canonicalToken() only strips plural -s/-es/-ies (and only for tokens
  // longer than 4 characters); it does not stem verb tenses, so a 4-letter
  // inflection like "used" is compared literally and never matches its
  // already-scaffolding base form "use". Question phrasings built entirely
  // from ordinary verbs like "What is X used for?" or "How was X built?"
  // then had that inflection treated as a REQUIRED content topic with no
  // corresponding scaffolding entry, so evidence that plainly covers the
  // question (e.g. a transcript that never says the literal word "used")
  // failed the coverage gate and fell back to GENERAL even though the
  // question was fully answerable from the retrieved evidence. These are
  // inflections of verbs already judged scaffolding above (use, build,
  // create, implement, help, work, make, explain, describe, show, give,
  // understand, learn, compare, summarize, say) — not a new judgment call
  // about which words carry content, just completing families already
  // excluded from topic extraction.
  'used', 'uses', 'built', 'builds', 'building', 'creates', 'created',
  'creating', 'implements', 'implemented', 'implementing', 'helps',
  'helped', 'helping', 'worked', 'working', 'makes', 'made', 'making',
  'explains', 'explained', 'explaining', 'describes', 'described',
  'describing', 'shows', 'showed', 'showing', 'gives', 'gave', 'given',
  'giving', 'understands', 'understood', 'understanding', 'learns',
  'learned', 'compares', 'compared', 'comparing', 'summarizes',
  'summarized', 'summarizing', 'says',
]);

const STEM_EXEMPTIONS = new Set([
  'css', 'dsa', 'devops', 'html', 'kubernetes', 'mlops', 'redis', 'sass',
]);

function normalizeKnownCompounds(value: string): string {
  return value
    .replace(/\bback[\s-]?end\b/gi, 'backend')
    .replace(/\bfront[\s-]?end\b/gi, 'frontend')
    .replace(/\bmachine[\s-]+learning[\s-]+operations\b/gi, 'mlops')
    .replace(/\bdata[\s-]+structures?\s+(?:and\s+)?algorithms?\b/gi, 'dsa')
    .replace(/\bci\s*\/\s*cd\b/gi, 'cicd')
    .replace(/\bc\+\+\b/gi, 'cpp')
    .replace(/\bc#\b/gi, 'csharp');
}

function canonicalToken(value: string): string {
  const token = value.toLowerCase();
  if (STEM_EXEMPTIONS.has(token) || token.length <= 4) return token;
  if (token.endsWith('ies') && token.length > 5) return `${token.slice(0, -3)}y`;
  if (token.endsWith('es') && token.length > 5) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function contentTokens(value: string): Set<string> {
  const tokens = normalizeKnownCompounds(value).match(/[\p{L}\p{N}]+/gu) || [];
  const normalized = new Set(tokens.map(canonicalToken));
  if (normalized.has('k8s')) normalized.add('kubernetes');
  if (normalized.has('kubernetes')) normalized.add('k8s');
  if (normalized.has('server') && normalized.has('side')) normalized.add('backend');
  if (normalized.has('client') && normalized.has('side')) normalized.add('frontend');
  return normalized;
}

function distinctiveTopicGroups(query: string): string[][] {
  return normalizeKnownCompounds(query)
    .split(/\b(?:and|or|plus|versus|vs)\b|[,&/]+/i)
    .map((clause) => {
      const tokens = clause.match(/[\p{L}\p{N}]+/gu) || [];
      return [...new Set(
        tokens
          .map((rawToken) => ({
            raw: rawToken.toLowerCase(),
            canonical: canonicalToken(rawToken),
          }))
          .filter(
            ({ raw, canonical }) =>
              !QUERY_SCAFFOLDING.has(raw) &&
              !QUERY_SCAFFOLDING.has(canonical) &&
              (canonical.length >= 3 ||
                ['ai', 'db', 'ml', 'os', 'ui', 'ux'].includes(canonical)),
          )
          .map(({ canonical }) => canonical),
      )];
    })
    .filter((group) => group.length > 0);
}

export function normalizedDistinctiveTopicQuery(query: string): string | null {
  const groups = distinctiveTopicGroups(query);
  return groups.length > 0
    ? groups.map((group) => group.join(' ')).join(' and ')
    : null;
}

export function latestGroundedFollowUpTopicQuery(
  messages: GroundedHistoryMessage[],
): string | null {
  const usersById = new Map(
    messages
      .filter((message) => message.role === 'USER')
      .map((message) => [message.id, message]),
  );
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const assistant = messages[index];
    if (
      assistant.role !== 'ASSISTANT' ||
      assistant.status !== 'SUCCESS' ||
      assistant.responseMode !== 'GROUNDED' ||
      !assistant.parentMessageId ||
      !assistant.citations?.length
    ) {
      continue;
    }
    const parent = usersById.get(assistant.parentMessageId);
    const topicQuery = parent
      ? normalizedDistinctiveTopicQuery(parent.content)
      : null;
    if (topicQuery) return topicQuery;
  }
  return null;
}

function requiredTopicMatches(group: string[]): number {
  if (group.length <= 2) return group.length;
  return Math.ceil(group.length * 0.6);
}

function hasTopicToken(tokens: Set<string>, topicToken: string): boolean {
  if (tokens.has(topicToken)) return true;
  if (topicToken.length < 4) return false;
  return [...tokens].some(
    (candidate) =>
      candidate.length >= 4 &&
      Math.abs(candidate.length - topicToken.length) <= 1 &&
      (candidate.startsWith(topicToken) || topicToken.startsWith(candidate)),
  );
}

/**
 * The embedding threshold establishes candidate relevance; this second,
 * deterministic gate establishes complete topic coverage. Every distinctive
 * requested topic group must be represented in at least one actual context
 * chunk. Generic follow-ups with no extractable topic keep the existing
 * semantic-only behavior.
 */
export function assessWorkspaceEvidenceSufficiency(
  query: string,
  evidence: AnswerabilityEvidence[],
): EvidenceSufficiencyAssessment {
  if (evidence.length === 0) {
    return {
      sufficient: false,
      reason: 'no_context',
      topicGroupCount: 0,
      coveredTopicGroupCount: 0,
    };
  }

  const topicGroups = distinctiveTopicGroups(query);
  if (topicGroups.length === 0) {
    return {
      sufficient: true,
      reason: 'semantic_only_query',
      topicGroupCount: 0,
      coveredTopicGroupCount: 0,
    };
  }

  const evidenceTokenSets = evidence.map(({ content, sourceTitle }) =>
    contentTokens(`${sourceTitle}\n${content}`),
  );
  const coveredTopicGroupCount = topicGroups.filter((group) => {
    const requiredMatches = requiredTopicMatches(group);
    return evidenceTokenSets.some((tokens) => {
      const matches = group.filter((token) => hasTopicToken(tokens, token)).length;
      return matches >= requiredMatches;
    });
  }).length;
  const sufficient = coveredTopicGroupCount === topicGroups.length;
  return {
    sufficient,
    reason: sufficient ? 'complete_topic_coverage' : 'missing_topic_coverage',
    topicGroupCount: topicGroups.length,
    coveredTopicGroupCount,
  };
}

export function isWorkspaceMetaQuestion(query: string): boolean {
  const normalized = query.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  if (UPLOAD_INTENT.test(normalized) || SOURCE_CONTENT_INTENT.test(normalized)) {
    return true;
  }
  return (
    CONTENT_INTENT.test(normalized) &&
    (POSSESSIVE_SOURCE_REFERENCE.test(normalized) ||
      WORKSPACE_REFERENCE.test(normalized))
  );
}

export type InitialChatRoute =
  | { kind: 'DETERMINISTIC_NO_SOURCES'; responseMode: 'GROUNDED' }
  | { kind: 'GENERAL_WITHOUT_RETRIEVAL'; responseMode: 'GENERAL' }
  | { kind: 'RETRIEVE' };

export function selectInitialChatRoute(input: {
  sourceCount: number;
  query: string;
  isAIAction: boolean;
}): InitialChatRoute {
  if (input.isAIAction || input.sourceCount > 0) return { kind: 'RETRIEVE' };
  return isWorkspaceMetaQuestion(input.query)
    ? { kind: 'DETERMINISTIC_NO_SOURCES', responseMode: 'GROUNDED' }
    : { kind: 'GENERAL_WITHOUT_RETRIEVAL', responseMode: 'GENERAL' };
}

export function selectResponseModeAfterRetrieval(input: {
  hasContext: boolean;
  hasSufficientEvidence: boolean;
  isAIAction: boolean;
  isWorkspaceMeta: boolean;
}): ChatResponseMode | null {
  if (
    input.hasContext &&
    (input.isAIAction || input.isWorkspaceMeta || input.hasSufficientEvidence)
  ) {
    return 'GROUNDED';
  }
  if (input.isAIAction) return null;
  return input.isWorkspaceMeta ? 'GROUNDED' : 'GENERAL';
}
