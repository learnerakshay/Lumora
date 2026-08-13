export type DashboardSourceType = 'PDF' | 'WEBSITE' | 'TEXT' | 'YOUTUBE' | 'VTT';
export type DashboardSourceStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface DashboardWorkspace {
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

export interface DashboardSourceSummary {
  id: string;
  workspaceId: string;
  type: DashboardSourceType;
  status: DashboardSourceStatus;
}

type ApiPayload<T> = { success?: boolean; data?: T; error?: { message?: string } };

const workspaceRequests = new Map<string, Promise<DashboardWorkspace[]>>();

async function readApiData<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => null) as ApiPayload<T> | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || fallbackMessage);
  }
  return payload.data as T;
}

export function fetchDashboardWorkspaces(
  authenticatedUserId: string,
  request: typeof fetch = fetch,
): Promise<DashboardWorkspace[]> {
  const existing = workspaceRequests.get(authenticatedUserId);
  if (existing) return existing;

  const pending = request('/api/workspaces')
    .then((response) => readApiData<DashboardWorkspace[]>(response, 'Failed to load Workspaces.'))
    .then((records) => {
      if (!Array.isArray(records)) throw new Error('Invalid Workspace response.');
      return records;
    })
    .finally(() => {
      if (workspaceRequests.get(authenticatedUserId) === pending) {
        workspaceRequests.delete(authenticatedUserId);
      }
    });

  workspaceRequests.set(authenticatedUserId, pending);
  return pending;
}

export async function fetchDashboardSourceSummaries(
  request: typeof fetch = fetch,
): Promise<DashboardSourceSummary[]> {
  const response = await request('/api/workspaces/source-summaries');
  const records = await readApiData<DashboardSourceSummary[]>(
    response,
    'Failed to load source summaries.',
  );
  return Array.isArray(records) ? records : [];
}

export function groupDashboardSourceSummaries(
  records: DashboardSourceSummary[],
): Record<string, DashboardSourceSummary[]> {
  return records.reduce<Record<string, DashboardSourceSummary[]>>((grouped, record) => {
    (grouped[record.workspaceId] ||= []).push(record);
    return grouped;
  }, {});
}

export function shouldLoadDashboardSourceSummaries(
  workspaces: DashboardWorkspace[],
): boolean {
  return workspaces.length > 0;
}
