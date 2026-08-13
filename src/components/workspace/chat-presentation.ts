import type { AIActionId } from '../../lib/ai/actions/catalog';
import type { AIActionRequest } from '../../lib/ai/actions/types';

export type AnswerMode = 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';

export type GenerationPhase = 'GENERATING' | 'REGENERATING';

export interface GenerationStatusInput {
  actionId?: AIActionId | null;
  mode: AnswerMode;
  phase?: GenerationPhase;
}

interface GenerationMessageMetadata {
  id: string;
  parentMessageId: string | null;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  mode: AnswerMode;
  status: 'SENDING' | 'SUCCESS' | 'ERROR';
  action?: AIActionRequest | null;
}

export const AI_MODE_OPTIONS = [
  { id: 'CONCISE', label: 'Concise', description: 'Fast and focused', icon: 'zap' },
  { id: 'DETAILED', label: 'Detailed', description: 'Thorough explanation', icon: 'list' },
  { id: 'CRITICAL', label: 'Critical', description: 'Analyze and challenge', icon: 'search' },
  { id: 'CREATIVE', label: 'Creative', description: 'Explore ideas', icon: 'spark' },
] as const satisfies ReadonlyArray<{
  id: AnswerMode;
  label: string;
  description: string;
  icon: 'zap' | 'list' | 'search' | 'spark';
}>;

const ACTION_GENERATION_COPY: Record<AIActionId, string> = {
  summarize: 'Summarizing validated Workspace context',
  explain: 'Preparing a grounded explanation',
  compare: 'Comparing validated Workspace sources',
  generate_notes: 'Generating grounded notes',
  key_takeaways: 'Extracting key takeaways from validated context',
};

const ACTION_REGENERATION_COPY: Record<AIActionId, string> = {
  summarize: 'Regenerating the grounded summary',
  explain: 'Regenerating the grounded explanation',
  compare: 'Regenerating the grounded comparison',
  generate_notes: 'Regenerating the grounded notes',
  key_takeaways: 'Regenerating the grounded takeaways',
};

export function getGenerationStatusLabel({
  actionId,
  mode,
  phase = 'GENERATING',
}: GenerationStatusInput): string {
  const modeLabel = AI_MODE_OPTIONS.find((option) => option.id === mode)?.label || 'Detailed';
  const base = actionId
    ? phase === 'REGENERATING'
      ? ACTION_REGENERATION_COPY[actionId]
      : ACTION_GENERATION_COPY[actionId]
    : phase === 'REGENERATING'
      ? 'Regenerating the grounded response'
      : 'Finding relevant context and preparing a grounded response';
  return `${base} · ${modeLabel} mode…`;
}

export function getPersistedGenerationStatus(
  messages: readonly GenerationMessageMetadata[],
): GenerationStatusInput | null {
  const pendingAssistant = messages.find(
    (message) => message.role === 'ASSISTANT' && message.status === 'SENDING',
  );
  if (!pendingAssistant?.parentMessageId) return null;
  const originatingUser = messages.find(
    (message) =>
      message.id === pendingAssistant.parentMessageId && message.role === 'USER',
  );
  if (!originatingUser) return null;
  return {
    actionId: originatingUser.action?.actionId,
    mode: originatingUser.mode,
    phase: 'GENERATING',
  };
}

export type CitationTextPart =
  | { type: 'text'; value: string }
  | { type: 'citation'; value: string; citationNumber: number };

export function splitCitationMarkers(value: string): CitationTextPart[] {
  const pattern = /\[Citation\s*#(\d+)\]/gi;
  const parts: CitationTextPart[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) parts.push({ type: 'text', value: value.slice(cursor, match.index) });
    parts.push({ type: 'citation', value: match[0], citationNumber: Number(match[1]) });
    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) parts.push({ type: 'text', value: value.slice(cursor) });
  return parts.length ? parts : [{ type: 'text', value }];
}
