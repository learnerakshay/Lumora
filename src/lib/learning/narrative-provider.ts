import { getServerEnv } from '../env';
import { logger } from '../logger';
import {
  NARRATIVE_JSON_SCHEMA,
  parseRawNarrative,
  type NarrativeRequestInput,
  type RawNarrative,
} from './narrative-contract';

const NARRATIVE_TIMEOUT_MS = 20_000;

const NARRATIVE_INSTRUCTIONS = `You write short, honest career-coaching narration for a software engineering learning plan. You are given a target role title, an overall readiness band, and a fixed list of already-decided learning steps — each with an id, subject, category, priority band, required competency label, target evidence level, and currently observed evidence level. For every step, write one concise sentence (under 240 characters) explaining specifically why closing that gap matters for that exact role, plus one short sentence briefing the evidence task. Also write one overall readiness summary sentence for the whole plan. Echo each step's id back exactly as given. Never invent a skill, requirement, gap, company, or personal detail that was not given to you — you are only given structured labels, never resume text. Never change the priority, category, or competency of any step.`;

interface OpenAIResponsesPayload {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

function extractOutputText(payload: OpenAIResponsesPayload): string | null {
  for (const item of payload.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return null;
}

export interface NarrationResult {
  narrative: RawNarrative;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

// Narration is purely additive prose on top of an already-complete
// deterministic plan. Any failure here — missing config, network error,
// non-2xx, malformed JSON, schema mismatch — is caught and logged, never
// thrown: the caller always falls back to deterministic text and the plan
// still builds and persists.
export async function narrateLearningPlan(input: NarrativeRequestInput): Promise<NarrationResult | null> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) return null;
  if (input.steps.length === 0) return null;

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.CHAT_MODEL,
        instructions: NARRATIVE_INSTRUCTIONS,
        input: [{ role: 'user', content: JSON.stringify(input) }],
        stream: false,
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: 'learning_plan_narration',
            schema: NARRATIVE_JSON_SCHEMA,
            strict: true,
          },
        },
      }),
      signal: AbortSignal.timeout(NARRATIVE_TIMEOUT_MS),
    });
  } catch (error) {
    logger.warn('Learning plan narration request failed', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return null;
  }

  if (!response.ok) {
    await response.text().catch(() => null);
    logger.warn('Learning plan narration was rejected by the provider', { status: response.status });
    return null;
  }

  let payload: OpenAIResponsesPayload;
  try {
    payload = (await response.json()) as OpenAIResponsesPayload;
  } catch {
    logger.warn('Learning plan narration response was not valid JSON');
    return null;
  }

  const text = extractOutputText(payload);
  if (!text) {
    logger.warn('Learning plan narration returned no output text');
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    logger.warn('Learning plan narration output was not valid JSON');
    return null;
  }

  const parsed = parseRawNarrative(json);
  if (parsed.success === false) {
    logger.warn('Learning plan narration output failed schema validation', { error: parsed.error });
    return null;
  }

  const usage = payload.usage;
  return {
    narrative: parsed.data,
    model: env.CHAT_MODEL,
    ...(Number.isInteger(usage?.input_tokens) && Number.isInteger(usage?.output_tokens)
      ? { usage: { inputTokens: usage!.input_tokens!, outputTokens: usage!.output_tokens! } }
      : {}),
  };
}
