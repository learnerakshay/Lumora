import type { ChatResponseMode } from '../../types';

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
  isAIAction: boolean;
  isWorkspaceMeta: boolean;
}): ChatResponseMode | null {
  if (input.hasContext) return 'GROUNDED';
  if (input.isAIAction) return null;
  return input.isWorkspaceMeta ? 'GROUNDED' : 'GENERAL';
}
