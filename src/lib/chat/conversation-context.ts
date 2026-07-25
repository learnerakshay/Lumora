import { StoredMessage } from './conversation-store';

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_HISTORY_TOKEN_BUDGET = 3_000;

function estimatedTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

/**
 * Replays only complete, successfully persisted, still-grounded user/assistant
 * turns. The latest user message is supplied separately to the provider.
 */
export function buildConversationHistory(
  messages: StoredMessage[],
  currentUserMessageId: string,
  tokenBudget = DEFAULT_HISTORY_TOKEN_BUDGET,
): ChatHistoryItem[] {
  const seenIds = new Set<string>();
  const uniqueMessages = messages.filter((message) => {
    if (seenIds.has(message.id)) return false;
    seenIds.add(message.id);
    return message.id !== currentUserMessageId && message.status === 'SUCCESS';
  });

  const completeTurns: Array<[StoredMessage, StoredMessage]> = [];
  let pendingUser: StoredMessage | null = null;

  for (const message of uniqueMessages) {
    if (message.role === 'USER') {
      pendingUser = message;
      continue;
    }
    if (message.role !== 'ASSISTANT' || !pendingUser) continue;

    // An assistant response without any currently valid citation is not safe
    // evidence for a later grounded answer.
    if (!message.citations?.length) {
      pendingUser = null;
      continue;
    }

    completeTurns.push([pendingUser, message]);
    pendingUser = null;
  }

  const selected: Array<[StoredMessage, StoredMessage]> = [];
  let consumedTokens = 0;
  const budget = Math.max(0, Math.floor(tokenBudget));

  for (let index = completeTurns.length - 1; index >= 0; index -= 1) {
    const turn = completeTurns[index];
    const turnTokens =
      estimatedTokens(turn[0].content) + estimatedTokens(turn[1].content) + 8;
    if (consumedTokens + turnTokens > budget) continue;
    selected.unshift(turn);
    consumedTokens += turnTokens;
  }

  return selected.flatMap(([user, assistant]) => [
    { role: 'user' as const, content: user.content },
    { role: 'assistant' as const, content: assistant.content },
  ]);
}
