import { getToken, useSession } from './session';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8005').replace(/\/$/, '');

/** Every failed request becomes an ApiError with a stable `code` the UI can explain. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public requestId: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Worth retrying automatically / offering a Retry button. */
  get retryable() {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;
// AI-backed endpoints can legitimately take longer.
const SLOW_PATHS = ['/chat', '/suggest', '/follow-up', '/generate', '/summary', '/insight', '/messages'];

const newRequestId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal; auth?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const requestId = newRequestId();
  const headers: Record<string, string> = { 'X-Request-ID': requestId };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token && options.auth !== false) headers.Authorization = `Bearer ${token}`;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError("You're offline. Check your internet connection.", 0, 'OFFLINE', requestId);
  }

  const timeoutMs = options.timeoutMs ?? (SLOW_PATHS.some((p) => path.includes(p)) ? 60_000 : DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    window.clearTimeout(timer);
    if (timedOut) throw new ApiError('The server took too long to respond.', 408, 'TIMEOUT', requestId);
    if ((e as Error).name === 'AbortError') throw e; // cancelled by the caller (e.g. React Query)
    throw new ApiError("We couldn't reach the server.", 0, 'NETWORK_ERROR', requestId);
  }
  window.clearTimeout(timer);

  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error;
    const serverId = err?.request_id || res.headers.get('X-Request-ID') || requestId;
    const message = err?.message || (typeof body?.detail === 'string' ? body.detail : `Request failed (${res.status})`);
    const code = err?.code || (res.status >= 500 ? 'SERVER_ERROR' : `HTTP_${res.status}`);
    if (res.status === 401 && token && options.auth !== false) {
      useSession.getState().signOut();
    }
    throw new ApiError(message, res.status, code, serverId, err?.fields);
  }
  return body as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
