import { prisma } from './prisma';

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  sourcesCount: number;
}

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${base || 'workspace'}-${randomSuffix}`;
}

function toWorkspaceRecord(workspace: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { sources: number };
}): WorkspaceRecord {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    icon: workspace.icon || 'folder',
    userId: workspace.userId,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
    sourcesCount: workspace._count?.sources ?? 0,
  };
}

export async function getWorkspaces(userId: string): Promise<WorkspaceRecord[]> {
  const records = await prisma.workspace.findMany({
    where: { userId },
    include: {
      _count: {
        select: { sources: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return records.map(toWorkspaceRecord);
}

export async function createWorkspace(data: {
  name: string;
  description?: string;
  icon?: string;
  userId: string;
}): Promise<WorkspaceRecord> {
  const record = await prisma.workspace.create({
    data: {
      name: data.name.trim(),
      slug: slugify(data.name),
      description: data.description?.trim() || null,
      icon: data.icon || 'folder',
      userId: data.userId,
    },
  });

  return toWorkspaceRecord(record);
}

export async function getWorkspaceById(
  id: string,
  userId: string,
): Promise<WorkspaceRecord | null> {
  const record = await prisma.workspace.findFirst({
    where: {
      userId,
      OR: [{ id }, { slug: id }],
    },
    include: {
      _count: { select: { sources: true } },
    },
  });

  return record ? toWorkspaceRecord(record) : null;
}

export async function updateWorkspace(
  id: string,
  data: { name?: string; description?: string; icon?: string },
  userId: string,
): Promise<WorkspaceRecord | null> {
  const existing = await prisma.workspace.findFirst({
    where: {
      userId,
      OR: [{ id }, { slug: id }],
    },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.workspace.update({
    where: { id: existing.id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined
        ? { description: data.description.trim() || null }
        : {}),
      ...(data.icon !== undefined ? { icon: data.icon } : {}),
    },
    include: {
      _count: { select: { sources: true } },
    },
  });

  return toWorkspaceRecord(updated);
}

export async function deleteWorkspace(id: string, userId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.workspace.findFirst({
      where: {
        userId,
        OR: [{ id }, { slug: id }],
      },
      select: { id: true },
    });

    if (!existing) {
      return false;
    }

    await tx.workspace.delete({ where: { id: existing.id } });
    return true;
  });
}
