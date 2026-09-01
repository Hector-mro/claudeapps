import type { ReviewResponse, TodayResponse } from '../shared/types';

export interface Domain {
  id: number;
  name: string;
  minimum_standard: string;
  owner_id: number;
  owner_name: string;
  owner_color: string;
}

export interface CompletionResult {
  completion_id: number;
  next_due_on: string;
  removed: boolean;
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch('/api/' + token + path, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(response.status, body.error ?? 'unknown');
  }
  return (await response.json()) as T;
}

export const api = {
  today: (token: string) => request<TodayResponse>(token, '/today'),

  domains: (token: string) => request<{ domains: Domain[] }>(token, '/domains').then((r) => r.domains),

  complete: (token: string, taskId: number, personId: number) =>
    request<CompletionResult>(token, '/tasks/' + taskId + '/complete', {
      method: 'POST',
      body: JSON.stringify({ person_id: personId }),
    }),

  skip: (token: string, taskId: number, personId: number) =>
    request<CompletionResult>(token, '/tasks/' + taskId + '/skip', {
      method: 'POST',
      body: JSON.stringify({ person_id: personId }),
    }),

  undo: (token: string, completionId: number) =>
    request<{ task_id: number; next_due_on: string }>(token, '/completions/' + completionId, { method: 'DELETE' }),

  review: (token: string) => request<ReviewResponse>(token, '/review'),

  reassign: (token: string, domainId: number, ownerId: number) =>
    request<{ ok: true }>(token, '/domains/' + domainId + '/owner', {
      method: 'POST',
      body: JSON.stringify({ owner_id: ownerId }),
    }),

  deactivate: (token: string, taskId: number) =>
    request<{ ok: true }>(token, '/tasks/' + taskId, { method: 'DELETE' }),

  addOneoff: (token: string, title: string, domainId: number) =>
    request<{ id: number }>(token, '/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, domain_id: domainId }),
    }),
};
