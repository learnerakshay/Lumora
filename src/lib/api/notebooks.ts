export type Notebook = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { sources: number; conversations: number };
};
export type NotebookDetail = Notebook & {
  sources: Array<{
    id: string;
    title: string;
    sourceType: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  roadmaps: Array<{ id: string; title: string; updatedAt: string }>;
};
type ApiErrorPayload = { error?: { code?: string; message?: string } };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(body.error?.message ?? "Request failed.");
  }
  if (response.status === 204) return undefined as T;
  return ((await response.json()) as { data: T }).data;
}

export const listNotebooks = () => request<Notebook[]>("/api/notebooks");
export const getNotebook = (id: string) =>
  request<NotebookDetail>(`/api/notebooks/${id}`);
export const createNotebook = (input: {
  name: string;
  description?: string | null;
}) =>
  request<Notebook>("/api/notebooks", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const updateNotebook = (
  id: string,
  input: { name?: string; description?: string | null },
) =>
  request<Notebook>(`/api/notebooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
export const deleteNotebook = (id: string) =>
  request<void>(`/api/notebooks/${id}`, { method: "DELETE" });
