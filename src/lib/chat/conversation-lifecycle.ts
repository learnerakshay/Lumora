import type { StoredMessage } from './conversation-store';

export function shouldApplyMessageSnapshot(
  requestedAtRevision: number,
  currentRevision: number,
): boolean {
  return requestedAtRevision === currentRevision;
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
