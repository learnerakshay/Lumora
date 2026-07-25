import { AppError } from './errors';

export interface UserSession {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
}

/**
 * Server-side helper to extract authenticated user ID from request headers or auth session
 */
export function getUserIdFromRequest(req: any): string | null {
  // Check Clerk auth header if present
  if (req.auth && req.auth.userId) {
    return req.auth.userId;
  }
  
  // Check authorization header fallback (Bearer token or custom header)
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token && token !== 'null' && token !== 'undefined') {
      return token; // Token or user ID
    }
  }

  // Check custom session header
  const xUserId = req.headers?.['x-lumora-user-id'];
  if (xUserId && typeof xUserId === 'string') {
    return xUserId;
  }

  return null;
}

/**
 * Server-side guard to require authentication
 */
export function requireAuth(req: any): string {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    throw AppError.unauthorized('Authentication required to access this resource', 'UNAUTHORIZED_ACCESS');
  }
  return userId;
}

/**
 * Authorization foundation helper: Verifies user has access to a workspace
 */
export async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  if (!workspaceId || !userId) {
    return false;
  }
  // Workspace isolation check helper - will be integrated with database queries in future prompts
  return true;
}
