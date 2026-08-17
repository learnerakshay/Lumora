import { getServerEnv } from '../env';
import { logger } from '../logger';
import {
  EXTRACTION_JSON_SCHEMA,
  assignExtractionIds,
  isEmptyRawExtraction,
  parseRawExtractedProfile,
  type ExtractionValidationIssue,
} from './extraction-contract';
import type { ExtractedProfile } from './types';

export class SkillExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 502,
  ) {
    super(message);
    this.name = 'SkillExtractionError';
  }
}

const MAX_RESUME_CHARS = 30_000;
const EXTRACTION_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2;

// Shown to users on any exhausted-retry extraction failure. Raw provider/Zod
// detail (field paths, issue messages) is never sent to the client — it is
// only ever passed to logger.warn, which the API route does not forward.
const STABLE_UNREADABLE_RESUME_MESSAGE =
  "We couldn't reliably read this resume. Try a clearer image, PDF, or paste the resume text.";

const EXTRACTION_INSTRUCTIONS = `You transcribe the literal content of a resume into structured JSON. The resume may be provided as text or as an image — if it is an image, read every visible word carefully before transcribing. You are not a recruiter or career coach: never rate skill proficiency, never infer a skill the resume does not name, and never invent projects, employers, dates, or outcomes. If a field is not stated, use null (never an empty string) or an empty array rather than guessing. Set "hasLink" on a project only when the resume text contains an actual URL for it. Copy skill, technology, organization, and institution names as written. If the provided content is not a legible resume at all, return every field empty rather than fabricating one.`;

// The only fields ever logged from a validation issue: field path, zod
// check code, and the configured bound it tripped. Never the field's value.
function safeIssueLog(issue: ExtractionValidationIssue) {
  return {
    path: issue.path,
    code: issue.code,
    ...(issue.maximum !== undefined ? { maximum: issue.maximum } : {}),
    ...(issue.minimum !== undefined ? { minimum: issue.minimum } : {}),
  };
}

function safeProviderMessage(status: number): string {
  if (status === 429) return 'The AI provider is rate limited. Please try again shortly.';
  if (status === 401 || status === 403) return 'The AI provider configuration was rejected.';
  if (status >= 500) return 'The AI provider is temporarily unavailable.';
  return 'The AI provider rejected the extraction request.';
}

interface OpenAIResponsesPayload {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
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

type ExtractionSource =
  | { kind: 'text'; text: string }
  | { kind: 'image'; base64: string; mimeType: string };

function buildResponsesInput(source: ExtractionSource): unknown[] {
  if (source.kind === 'text') {
    return [{ role: 'user', content: source.text }];
  }
  return [
    {
      role: 'user',
      content: [
        { type: 'input_text', text: 'Extract the resume content visible in this image.' },
        { type: 'input_image', image_url: `data:${source.mimeType};base64,${source.base64}` },
      ],
    },
  ];
}

async function callResponsesApi(
  source: ExtractionSource,
  apiKey: string,
  model: string,
): Promise<OpenAIResponsesPayload> {
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions: EXTRACTION_INSTRUCTIONS,
        input: buildResponsesInput(source),
        stream: false,
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: 'resume_extraction',
            schema: EXTRACTION_JSON_SCHEMA,
            strict: true,
          },
        },
      }),
      signal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS),
    });
  } catch {
    throw new SkillExtractionError('The AI provider could not be reached.', 'EXTRACTION_NETWORK_FAILURE');
  }
  if (!response.ok) {
    await response.text().catch(() => null);
    throw new SkillExtractionError(
      safeProviderMessage(response.status),
      response.status === 429 ? 'EXTRACTION_RATE_LIMITED' : 'EXTRACTION_REQUEST_REJECTED',
      response.status,
    );
  }
  return response.json() as Promise<OpenAIResponsesPayload>;
}

export interface ExtractionResult {
  profile: ExtractedProfile;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

// One retry on schema-invalid or unreadable output, then a hard failure.
// This is a transcription boundary, not a judgment boundary — normalize /
// role-matching / gap-analysis downstream never call the model again, and
// both the text and image entry points funnel through this single runner so
// the retry/parse/reject behavior can never drift between them.
async function runExtraction(source: ExtractionSource): Promise<ExtractionResult> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    throw new SkillExtractionError('Skill extraction is not configured.', 'EXTRACTION_NOT_CONFIGURED', 503);
  }

  let lastError = 'The AI provider returned no extraction output.';
  let lastIssues: ExtractionValidationIssue[] = [];
  let lastFailureWasUnreadable = false;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const payload = await callResponsesApi(source, env.OPENAI_API_KEY, env.CHAT_MODEL);
    const text = extractOutputText(payload);
    if (!text) {
      lastError = 'The AI provider returned no extraction output.';
      lastIssues = [];
      lastFailureWasUnreadable = false;
      continue;
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      lastError = 'The AI provider returned malformed JSON.';
      lastIssues = [];
      lastFailureWasUnreadable = false;
      continue;
    }

    const parsed = parseRawExtractedProfile(json);
    if (!('data' in parsed)) {
      lastError = parsed.error;
      lastIssues = parsed.issues;
      lastFailureWasUnreadable = false;
      logger.warn('Skill extraction output failed schema validation', {
        attempt,
        sourceKind: source.kind,
        issues: parsed.issues.map(safeIssueLog),
      });
      continue;
    }

    if (isEmptyRawExtraction(parsed.data)) {
      lastError = 'No resume content could be identified in what was provided.';
      lastIssues = [];
      lastFailureWasUnreadable = true;
      continue;
    }

    const usage = payload.usage;
    return {
      profile: assignExtractionIds(parsed.data),
      model: env.CHAT_MODEL,
      ...(Number.isInteger(usage?.input_tokens) && Number.isInteger(usage?.output_tokens)
        ? { usage: { inputTokens: usage!.input_tokens!, outputTokens: usage!.output_tokens! } }
        : {}),
    };
  }

  const code = lastFailureWasUnreadable ? 'EXTRACTION_EMPTY_CONTENT' : 'EXTRACTION_SCHEMA_INVALID';
  logger.warn('Skill extraction exhausted all attempts', {
    code,
    attempts: MAX_ATTEMPTS,
    sourceKind: source.kind,
    detail: lastError,
    issues: lastIssues.map(safeIssueLog),
  });
  throw new SkillExtractionError(STABLE_UNREADABLE_RESUME_MESSAGE, code, 422);
}

export async function extractProfileFromResumeText(input: { resumeText: string }): Promise<ExtractionResult> {
  return runExtraction({ kind: 'text', text: input.resumeText.slice(0, MAX_RESUME_CHARS) });
}

export async function extractProfileFromResumeImage(input: {
  imageBase64: string;
  imageMimeType: string;
}): Promise<ExtractionResult> {
  return runExtraction({ kind: 'image', base64: input.imageBase64, mimeType: input.imageMimeType });
}
