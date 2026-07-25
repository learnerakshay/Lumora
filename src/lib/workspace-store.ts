import { prisma } from './prisma';
import { logger } from './logger';

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  sourcesCount: number;
}

// Fallback in-memory storage when Postgres DB is unconfigured or unavailable
const fallbackWorkspaces: WorkspaceRecord[] = [
  {
    id: 'ws_default_main',
    name: 'Main Knowledge Workspace',
    slug: 'default-workspace',
    description: 'Primary isolated workspace environment for Lumora knowledge synthesis and source analysis.',
    icon: 'brain',
    userId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourcesCount: 3,
  },
];

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

export async function getWorkspaces(userId?: string | null): Promise<WorkspaceRecord[]> {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      const records = await prisma.workspace.findMany({
        where: userId ? { OR: [{ userId }, { userId: null }] } : undefined,
        include: {
          _count: {
            select: { sources: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return records.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        description: w.description,
        icon: w.icon || 'folder',
        userId: w.userId,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
        sourcesCount: w._count?.sources ?? 0,
      }));
    }
  } catch (err) {
    logger.warn('Prisma getWorkspaces failed, utilizing fallback store', err);
  }

  // Fallback return
  if (userId) {
    return fallbackWorkspaces.filter((w) => !w.userId || w.userId === userId);
  }
  return [...fallbackWorkspaces];
}

export async function createWorkspace(data: {
  name: string;
  description?: string;
  icon?: string;
  userId?: string | null;
}): Promise<WorkspaceRecord> {
  const name = data.name.trim();
  const description = data.description?.trim() || null;
  const icon = data.icon || 'folder';
  const slug = slugify(name);
  const userId = data.userId || null;

  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      const record = await prisma.workspace.create({
        data: {
          name,
          slug,
          description,
          icon,
          userId,
        },
      });

      return {
        id: record.id,
        name: record.name,
        slug: record.slug,
        description: record.description,
        icon: record.icon || 'folder',
        userId: record.userId,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        sourcesCount: 0,
      };
    }
  } catch (err) {
    logger.warn('Prisma createWorkspace failed, using fallback store', err);
  }

  // Fallback creation
  const newWorkspace: WorkspaceRecord = {
    id: `ws_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`,
    name,
    slug,
    description,
    icon,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourcesCount: 0,
  };

  fallbackWorkspaces.unshift(newWorkspace);
  return newWorkspace;
}

export async function getWorkspaceById(id: string, userId?: string | null): Promise<WorkspaceRecord | null> {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      const record = await prisma.workspace.findFirst({
        where: {
          OR: [{ id }, { slug: id }],
          ...(userId ? { OR: [{ userId }, { userId: null }] } : {}),
        },
        include: {
          _count: { select: { sources: true } },
        },
      });

      if (record) {
        return {
          id: record.id,
          name: record.name,
          slug: record.slug,
          description: record.description,
          icon: record.icon || 'folder',
          userId: record.userId,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
          sourcesCount: record._count?.sources ?? 0,
        };
      }
    }
  } catch (err) {
    logger.warn('Prisma getWorkspaceById failed, checking fallback store', err);
  }

  const found = fallbackWorkspaces.find((w) => w.id === id || w.slug === id);
  return found || null;
}

export async function updateWorkspace(
  id: string,
  data: { name?: string; description?: string; icon?: string },
  userId?: string | null
): Promise<WorkspaceRecord | null> {
  const updateData: { name?: string; description?: string | null; icon?: string } = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.description !== undefined) updateData.description = data.description.trim() || null;
  if (data.icon !== undefined) updateData.icon = data.icon;

  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      const existing = await prisma.workspace.findFirst({
        where: { OR: [{ id }, { slug: id }] },
      });

      if (existing) {
        const updated = await prisma.workspace.update({
          where: { id: existing.id },
          data: {
            ...updateData,
            updatedAt: new Date(),
          },
          include: {
            _count: { select: { sources: true } },
          },
        });

        return {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          description: updated.description,
          icon: updated.icon || 'folder',
          userId: updated.userId,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          sourcesCount: updated._count?.sources ?? 0,
        };
      }
    }
  } catch (err) {
    logger.warn('Prisma updateWorkspace failed, updating fallback store', err);
  }

  const index = fallbackWorkspaces.findIndex((w) => w.id === id || w.slug === id);
  if (index !== -1) {
    const current = fallbackWorkspaces[index];
    const updated: WorkspaceRecord = {
      ...current,
      name: updateData.name ?? current.name,
      description: updateData.description !== undefined ? updateData.description : current.description,
      icon: updateData.icon ?? current.icon,
      updatedAt: new Date().toISOString(),
    };
    fallbackWorkspaces[index] = updated;
    return updated;
  }

  return null;
}

export async function deleteWorkspace(id: string, userId?: string | null): Promise<boolean> {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost:5432/lumora')) {
      const existing = await prisma.workspace.findFirst({
        where: { OR: [{ id }, { slug: id }] },
      });

      if (existing) {
        await prisma.workspace.delete({
          where: { id: existing.id },
        });
        return true;
      }
    }
  } catch (err) {
    logger.warn('Prisma deleteWorkspace failed, removing from fallback store', err);
  }

  const index = fallbackWorkspaces.findIndex((w) => w.id === id || w.slug === id);
  if (index !== -1) {
    fallbackWorkspaces.splice(index, 1);
    return true;
  }

  return false;
}
