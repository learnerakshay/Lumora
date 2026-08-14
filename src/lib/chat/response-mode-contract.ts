import type { AnswerMode } from '../../types';

export interface ResponseModeContract {
  label: string;
  verbosity: 'low' | 'medium' | 'high';
  maxOutputTokens: number;
  lengthGuidance: string;
  styleGuidance: string;
}

export const RESPONSE_MODE_CONTRACTS: Record<AnswerMode, ResponseModeContract> = {
  CONCISE: {
    label: 'Concise',
    verbosity: 'low',
    maxOutputTokens: 2_048,
    lengthGuidance:
      'Keep substantial answers around 200–400 words; use less when the request is simple.',
    styleGuidance:
      'Lead with the answer, keep only decision-relevant facts, and use compact bullets when useful.',
  },
  DETAILED: {
    label: 'Detailed',
    verbosity: 'high',
    maxOutputTokens: 6_144,
    lengthGuidance:
      'For broad or multi-source requests, aim for roughly 900–1,500 words; scale down for narrower questions.',
    styleGuidance:
      'Provide structured explanatory depth, prioritize the strongest themes, and connect evidence across sources.',
  },
  CRITICAL: {
    label: 'Critical',
    verbosity: 'medium',
    maxOutputTokens: 5_120,
    lengthGuidance:
      'For substantial analysis, aim for roughly 700–1,200 words; scale down when fewer claims need examination.',
    styleGuidance:
      'Analyze assumptions, tensions, evidence quality, counterpoints, and limitations before reaching a judgment.',
  },
  CREATIVE: {
    label: 'Creative',
    verbosity: 'medium',
    maxOutputTokens: 5_120,
    lengthGuidance:
      'For substantial responses, aim for roughly 700–1,200 words; scale down when a shorter treatment is clearer.',
    styleGuidance:
      'Use engaging structure and expressive language while preserving exact factual grounding and clear conclusions.',
  },
};

export function getResponseModeContract(mode: AnswerMode): ResponseModeContract {
  return RESPONSE_MODE_CONTRACTS[mode];
}

export function responseModeInstructions(mode: AnswerMode): string {
  const contract = getResponseModeContract(mode);
  return `=== ${contract.label.toUpperCase()} RESPONSE CONTRACT ===
${contract.styleGuidance}
${contract.lengthGuidance}
Prioritize and synthesize instead of exhaustively enumerating every detail. Reserve enough space for a complete conclusion, and finish cleanly within the response budget.`;
}
