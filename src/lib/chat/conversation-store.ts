import { prisma } from '../prisma';
import { logger } from '../logger';

export interface StoredCitation {
  id: string;
  messageId?: string;
  chunkId?: string | null;
  title: string;
  snippet: string;
  kind?: 'DOCUMENT' | 'WEB' | 'CALCULATION';
  score?: number | null;
  url?: string | null;
  page?: number | string | null;
}

export interface StoredMessage {
  id: string;
  workspaceId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  mode: 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';
  status: 'SENDING' | 'SUCCESS' | 'ERROR';
  createdAt: string;
  citations?: StoredCitation[];
}

// In-memory fallback message store
const fallbackMessageStore: StoredMessage[] = [];

export async function getWorkspaceMessages(workspaceId: string): Promise<StoredMessage[]> {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      const dbMessages = await prisma.message.findMany({
        where: {
          OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
        },
        include: {
          citations: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return dbMessages.map((m) => ({
        id: m.id,
        workspaceId: m.workspaceId,
        role: m.role as 'USER' | 'ASSISTANT' | 'SYSTEM',
        content: m.content,
        mode: m.mode as 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE',
        status: m.status as 'SENDING' | 'SUCCESS' | 'ERROR',
        createdAt: m.createdAt.toISOString(),
        citations: m.citations.map((c) => ({
          id: c.id,
          messageId: c.messageId,
          chunkId: c.chunkId,
          title: c.title,
          snippet: c.snippet,
          kind: c.kind as 'DOCUMENT' | 'WEB' | 'CALCULATION',
          score: c.score,
        })),
      }));
    }
  } catch (err) {
    logger.warn('Prisma getWorkspaceMessages failed, using fallback store', err);
  }

  return fallbackMessageStore.filter(
    (m) => m.workspaceId === workspaceId
  );
}

export async function createWorkspaceMessage(data: {
  workspaceId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  mode?: 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE';
  status?: 'SENDING' | 'SUCCESS' | 'ERROR';
  citations?: Array<{
    chunkId?: string | null;
    title: string;
    snippet: string;
    kind?: 'DOCUMENT' | 'WEB' | 'CALCULATION';
    score?: number | null;
    url?: string | null;
    page?: number | string | null;
  }>;
}): Promise<StoredMessage> {
  const mode = data.mode || 'DETAILED';
  const status = data.status || 'SUCCESS';

  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      // Resolve workspace ID if slug passed
      let targetWsId = data.workspaceId;
      const ws = await prisma.workspace.findFirst({
        where: { OR: [{ id: data.workspaceId }, { slug: data.workspaceId }] },
      });
      if (ws) {
        targetWsId = ws.id;
      }

      const created = await prisma.message.create({
        data: {
          workspaceId: targetWsId,
          role: data.role,
          content: data.content,
          mode,
          status,
          citations: data.citations && data.citations.length > 0
            ? {
                create: data.citations.map((c) => ({
                  title: c.title,
                  snippet: c.snippet,
                  kind: c.kind || 'DOCUMENT',
                  score: c.score || 0.8,
                  chunkId: c.chunkId || null,
                })),
              }
            : undefined,
        },
        include: {
          citations: true,
        },
      });

      return {
        id: created.id,
        workspaceId: created.workspaceId,
        role: created.role as 'USER' | 'ASSISTANT' | 'SYSTEM',
        content: created.content,
        mode: created.mode as 'CONCISE' | 'DETAILED' | 'CRITICAL' | 'CREATIVE',
        status: created.status as 'SENDING' | 'SUCCESS' | 'ERROR',
        createdAt: created.createdAt.toISOString(),
        citations: created.citations.map((c) => ({
          id: c.id,
          messageId: c.messageId,
          chunkId: c.chunkId,
          title: c.title,
          snippet: c.snippet,
          kind: c.kind as 'DOCUMENT' | 'WEB' | 'CALCULATION',
          score: c.score,
        })),
      };
    }
  } catch (err) {
    logger.warn('Prisma createWorkspaceMessage failed, using fallback store', err);
  }

  // Fallback in-memory persistence
  const msgId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const citations = (data.citations || []).map((c, i) => ({
    id: `cit_${msgId}_${i}`,
    messageId: msgId,
    chunkId: c.chunkId || null,
    title: c.title,
    snippet: c.snippet,
    kind: c.kind || 'DOCUMENT',
    score: c.score || 0.8,
    url: c.url || null,
    page: c.page || null,
  }));

  const record: StoredMessage = {
    id: msgId,
    workspaceId: data.workspaceId,
    role: data.role,
    content: data.content,
    mode,
    status,
    createdAt: new Date().toISOString(),
    citations,
  };

  fallbackMessageStore.push(record);
  return record;
}

export async function clearWorkspaceMessages(workspaceId: string): Promise<boolean> {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      await prisma.message.deleteMany({
        where: {
          OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
        },
      });
    }
  } catch (err) {
    logger.warn('Prisma clearWorkspaceMessages failed, clearing fallback store', err);
  }

  for (let i = fallbackMessageStore.length - 1; i >= 0; i--) {
    if (fallbackMessageStore[i].workspaceId === workspaceId) {
      fallbackMessageStore.splice(i, 1);
    }
  }

  return true;
}
