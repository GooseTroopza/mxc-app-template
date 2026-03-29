/**
 * useApi — authenticated fetch helpers for MXC app API calls
 *
 * ALWAYS uses credentials: 'include' so the MXC session cookie is sent.
 * Without this, all protected endpoints return 401.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/tracker';

/** GET with auth cookie */
export async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('/') ? path : `${API_BASE}/${path}`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? json.message ?? 'API error');
  return json.data as T;
}

/** POST/PUT/DELETE with auth cookie */
export async function apiMutate<T>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  body?: unknown,
): Promise<T> {
  const url = path.startsWith('/') ? path : `${API_BASE}/${path}`;
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? json.message ?? 'API error');
  return json.data as T;
}

/** useQuery wrapper with auth */
export function useApiQuery<T>(path: string, options?: { enabled?: boolean }) {
  return useQuery<T, Error>({
    queryKey: ['tracker', path],
    queryFn: () => apiFetch<T>(path),
    ...options,
  });
}

/** useMutation wrapper with auth + cache invalidation */
export function useApiMutation<TBody = unknown, TResponse = unknown>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  options?: { invalidate?: string[] },
) {
  const qc = useQueryClient();
  return useMutation<TResponse, Error, TBody>({
    mutationFn: (body: TBody) => apiMutate<TResponse>(path, method, body),
    onSuccess: () => {
      if (options?.invalidate) {
        for (const p of options.invalidate) {
          qc.invalidateQueries({ queryKey: ['tracker', p] });
        }
      }
    },
  });
}
