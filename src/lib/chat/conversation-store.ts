import { prisma } from '../prisma';

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

export async function getWorkspaceMessages(workspaceId: string): Promise<StoredMessage[]> {
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
    },
    include: { citations: true },
    orderBy: { createdAt: 'asc' },
  });

  return messages.map((message) => ({
    id: message.id,
    workspaceId: message.workspaceId,
    role: message.role as StoredMessage['role'],
    content: message.content,
    mode: message.mode as StoredMessage['mode'],
    status: message.status as StoredMessage['status'],
    createdAt: message.createdAt.toISOString(),
    citations: message.citations.map((citation) => ({
      id: citation.id,
      messageId: citation.messageId,
      chunkId: citation.chunkId,
      title: citation.title,
      snippet: citation.snippet,
      kind: citation.kind as StoredCitation['kind'],
      score: citation.score,
    })),
  }));
}

export async function createWorkspaceMessage(data: {
  workspaceId: string;
  role: StoredMessage['role'];
  content: string;
  mode?: StoredMessage['mode'];
  status?: StoredMessage['status'];
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
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: data.workspaceId }, { slug: data.workspaceId }] },
    select: { id: true },
  });
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const created = await prisma.message.create({
    data: {
      workspaceId: workspace.id,
      role: data.role,
      content: data.content,
      mode: data.mode || 'DETAILED',
      status: data.status || 'SUCCESS',
      citations:
        data.citations && data.citations.length > 0
          ? {
              create: data.citations.map((citation) => ({
                title: citation.title,
                snippet: citation.snippet,
                kind: citation.kind || 'DOCUMENT',
                score: citation.score ?? 0.8,
                chunkId: citation.chunkId || null,
              })),
            }
          : undefined,
    },
    include: { citations: true },
  });

  return {
    id: created.id,
    workspaceId: created.workspaceId,
    role: created.role as StoredMessage['role'],
    content: created.content,
    mode: created.mode as StoredMessage['mode'],
    status: created.status as StoredMessage['status'],
    createdAt: created.createdAt.toISOString(),
    citations: created.citations.map((citation) => ({
      id: citation.id,
      messageId: citation.messageId,
      chunkId: citation.chunkId,
      title: citation.title,
      snippet: citation.snippet,
      kind: citation.kind as StoredCitation['kind'],
      score: citation.score,
    })),
  };
}

export async function clearWorkspaceMessages(workspaceId: string): Promise<boolean> {
  await prisma.message.deleteMany({
    where: {
      OR: [{ workspaceId }, { workspace: { slug: workspaceId } }],
    },
  });
  return true;
}
