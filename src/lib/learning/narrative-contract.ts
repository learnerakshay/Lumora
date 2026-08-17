import { z } from 'zod';
import type { EvidenceLevel, GapCategory } from '../skills/types';
import type { PriorityBand, ReadinessBand } from './types';

// Structured, already-decided facts only — never resume text, never
// free-form gap rationale. The model narrates around fixed labels it cannot
// change.
export interface NarrativeStepInput {
  stepId: string;
  subject: string;
  category: GapCategory;
  band: PriorityBand;
  competencyLabel: string;
  targetLevel: EvidenceLevel | null;
  observedLevel: EvidenceLevel | 'NONE';
}

export interface NarrativeRequestInput {
  roleTitle: string;
  readinessBand: ReadinessBand;
  readinessPercent: number;
  steps: readonly NarrativeStepInput[];
}

const shortNarrative = z.string().trim().max(400);

const rawNarrativeStepSchema = z.object({
  stepId: z.string().trim().min(1).max(200),
  whyItMatters: shortNarrative,
  evidenceBrief: shortNarrative,
});

const rawNarrativeSchema = z.object({
  readinessSummary: shortNarrative,
  steps: z.array(rawNarrativeStepSchema).max(12),
});

export type RawNarrativeStep = z.infer<typeof rawNarrativeStepSchema>;
export type RawNarrative = z.infer<typeof rawNarrativeSchema>;

export type NarrativeParseResult =
  | { success: true; data: RawNarrative }
  | { success: false; error: string };

export function parseRawNarrative(payload: unknown): NarrativeParseResult {
  const result = rawNarrativeSchema.safeParse(payload);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    error: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
  };
}

// Strict-mode JSON schema for the Responses API. Every string here has a
// deterministic fallback downstream, so a bare 'string' type is safe: an
// empty "" response is treated as "no narration for this step" and falls
// back, rather than being rejected and retried (see narratedTextForStep).
export const NARRATIVE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['readinessSummary', 'steps'],
  properties: {
    readinessSummary: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['stepId', 'whyItMatters', 'evidenceBrief'],
        properties: {
          stepId: { type: 'string' },
          whyItMatters: { type: 'string' },
          evidenceBrief: { type: 'string' },
        },
      },
    },
  },
} as const;

export interface NarratedStepText {
  whyItMatters: string;
  evidenceBrief: string;
}

// Narration is applied per step id. Any step id the model didn't return, or
// returned only empty text for, keeps its deterministic fallback text
// instead — the plan is never left with a blank sentence, and a narrative
// mismatch (missing id, extra id, empty string) can never invalidate the
// plan or change its decisions.
export function narratedTextForStep(
  stepId: string,
  fallback: NarratedStepText,
  narrative: RawNarrative | null,
): NarratedStepText {
  const entry = narrative?.steps.find((candidate) => candidate.stepId === stepId);
  const whyItMatters = entry?.whyItMatters.trim() || fallback.whyItMatters;
  const evidenceBrief = entry?.evidenceBrief.trim() || fallback.evidenceBrief;
  return { whyItMatters, evidenceBrief };
}

export function narratedReadinessSummary(fallback: string, narrative: RawNarrative | null): string {
  const summary = narrative?.readinessSummary.trim();
  return summary || fallback;
}
