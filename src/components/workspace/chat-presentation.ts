export type AnswerMode = 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';

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
