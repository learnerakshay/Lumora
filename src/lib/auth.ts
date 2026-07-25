import type { Request, RequestHandler } from 'express';
import { getAuth } from '@clerk/express';
import { AppError } from './errors';
import { prisma } from './prisma';
import { errorResponse } from './api-response';

export function getAuthenticatedUserId(req: Request): string | null {
  const auth = getAuth(req, { acceptsToken: 'session_token' });
  return auth.isAuthenticated && auth.userId ? auth.userId : null;
}

export function requireAuth(req: Request): string {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    throw AppError.unauthorized(
      'Authentication required to access this resource',
      'UNAUTHORIZED_ACCESS',
    );
  }
  return userId;
}

export const requireApiAuth: RequestHandler = (req, res, next) => {
  try {
    res.locals.userId = requireAuth(req);
    next();
  } catch (error) {
    const response = errorResponse(error);
    res.status(response.statusCode).json(response.payload);
  }
};

export async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  if (!workspaceId || !userId) {
    return false;
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      userId,
      OR: [{ id: workspaceId }, { slug: workspaceId }],
    },
    select: { id: true },
  });

  return Boolean(workspace);
}
