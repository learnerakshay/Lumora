import type { StoredMessage } from './conversation-store';

interface ConversationHistoryPayload {
  success?: boolean;
  data?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
  };
}

const EMPTY_HISTORY_CODES = new Set([
  'CONVERSATION_NOT_FOUND',
  'HISTORY_NOT_FOUND',
  'NO_CONVERSATION',
]);

export function parseConversationHistoryResponse(
  response: { ok: boolean; status: number },
  payload: unknown,
): StoredMessage[] {
  const candidate =
    payload && typeof payload === 'object'
      ? (payload as ConversationHistoryPayload)
      : null;

  if (response.ok) {
    if (response.status === 204) return [];
    if (Array.isArray(candidate?.data)) {
      return candidate.data as StoredMessage[];
    }
    if (
      candidate?.success === true &&
      (candidate.data === null || candidate.data === undefined)
    ) {
      return [];
    }
    throw new Error('Conversation history response was invalid.');
  }

  const errorCode =
    typeof candidate?.error?.code === 'string'
      ? candidate.error.code
      : null;
  if (response.status === 404 && errorCode && EMPTY_HISTORY_CODES.has(errorCode)) {
    return [];
  }

  const serverMessage =
    typeof candidate?.error?.message === 'string'
      ? candidate.error.message.trim()
      : '';
  throw new Error(
    serverMessage || `Failed to refresh conversation history (${response.status}).`,
  );
}

export function shouldApplyMessageSnapshot(
  requestedAtRevision: number,
  currentRevision: number,
): boolean {
  return requestedAtRevision === currentRevision;
}

export class ChatTransportInterruptedError extends Error {
  constructor(message = 'The chat response transport ended before a terminal event.') {
    super(message);
    this.name = 'ChatTransportInterruptedError';
  }
}

export function shouldRecoverInterruptedChatStream(
  error: unknown,
  state: {
    streamConnected: boolean;
    terminalEventReceived: boolean;
    transportAborted: boolean;
  },
): boolean {
  if (!state.streamConnected || state.terminalEventReceived || state.transportAborted) {
    return false;
  }
  return error instanceof ChatTransportInterruptedError;
}

export function reconcileCompletedTurn(
  messages: StoredMessage[],
  temporaryUserMessageId: string,
  userMessage: StoredMessage,
  assistantMessage: StoredMessage,
): StoredMessage[] {
  const temporaryIndex = messages.findIndex(
    (message) => message.id === temporaryUserMessageId,
  );
  const withoutTurn = messages.filter(
    (message) =>
      message.id !== temporaryUserMessageId &&
      message.id !== userMessage.id &&
      message.id !== assistantMessage.id &&
      message.parentMessageId !== userMessage.id,
  );
  const insertionIndex =
    temporaryIndex < 0
      ? withoutTurn.length
      : Math.min(temporaryIndex, withoutTurn.length);
  const next = [...withoutTurn];
  next.splice(insertionIndex, 0, userMessage, assistantMessage);
  return next;
}

export function replaceCompletedAssistant(
  messages: StoredMessage[],
  assistantMessage: StoredMessage,
): StoredMessage[] {
  return messages.map((message) =>
    message.id === assistantMessage.id ? assistantMessage : message,
  );
}

export function removeDeletedMessages(
  messages: StoredMessage[],
  deletedMessageIds: readonly string[],
): StoredMessage[] {
  const deleted = new Set(deletedMessageIds);
  return messages.filter((message) => !deleted.has(message.id));
}

export class ConversationOperationGate {
  private activeOperation: string | null = null;

  begin(operationId: string): boolean {
    if (this.activeOperation) return false;
    this.activeOperation = operationId;
    return true;
  }

  end(operationId: string): void {
    if (this.activeOperation === operationId) {
      this.activeOperation = null;
    }
  }

  get active(): string | null {
    return this.activeOperation;
  }
}

export class ConversationStreamGuard {
  private current: { workspaceId: string; operationId: string } | null = null;

  activate(workspaceId: string, operationId: string): void {
    this.current = { workspaceId, operationId };
  }

  isCurrent(workspaceId: string, operationId: string): boolean {
    return (
      this.current?.workspaceId === workspaceId &&
      this.current.operationId === operationId
    );
  }

  invalidate(workspaceId?: string): void {
    if (!workspaceId || this.current?.workspaceId === workspaceId) {
      this.current = null;
    }
  }

  get active(): Readonly<{ workspaceId: string; operationId: string }> | null {
    return this.current;
  }
}
