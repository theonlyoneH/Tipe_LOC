import { toast } from 'sonner';
import { ApiError } from './api';

export interface FriendlyError {
  title: string;
  message: string;
  code: string;
  ref?: string;
  retryable: boolean;
  fields?: Record<string, string>;
}

// Friendly copy per error code. The server message is used when a code isn't listed.
const COPY: Record<string, { title: string; message?: string }> = {
  OFFLINE: { title: "You're offline", message: 'Reconnect to the internet and try again.' },
  NETWORK_ERROR: { title: "Can't reach TIPE", message: 'The server may be waking up or your connection dropped. Try again in a few seconds.' },
  TIMEOUT: { title: 'This is taking too long', message: 'The server is slow to respond right now. Please try again.' },
  SESSION_EXPIRED: { title: 'Session expired', message: 'Please sign in again to continue.' },
  NOT_AUTHENTICATED: { title: 'Please sign in' },
  ACCOUNT_NOT_FOUND: { title: 'Account not found' },
  INVALID_CREDENTIALS: { title: "Couldn't sign you in" },
  EMAIL_TAKEN: { title: 'Email already registered' },
  VALIDATION_FAILED: { title: 'Please check the form' },
  RATE_LIMITED: { title: 'Slow down a little' },
  DATABASE_UNAVAILABLE: { title: 'Data temporarily unavailable' },
  INTERNAL_ERROR: { title: 'Something went wrong', message: "It's on our side, not yours. Please try again; if it keeps happening, share the reference below." },
  SERVER_ERROR: { title: 'Something went wrong', message: "It's on our side. Please try again in a moment." },
  UPSTREAM_ERROR: { title: 'A partner service is down', message: 'Please try again shortly.' },
  SERVICE_UNAVAILABLE: { title: 'Temporarily unavailable', message: 'Please try again shortly.' },
  CHUNK_LOAD_FAILED: { title: 'A new version is available', message: 'Reload the page to get the latest version.' },
  UI_CRASH: { title: 'This page hit a problem', message: 'The rest of the app still works. Try again or reload.' },
};

export function describeError(e: unknown, fallbackTitle = 'Something went wrong'): FriendlyError {
  if (e instanceof ApiError) {
    const copy = COPY[e.code];
    const notFound = e.status === 404 && !copy;
    return {
      title: copy?.title ?? (notFound ? 'Not found' : fallbackTitle),
      message: copy?.message ?? e.message,
      code: e.code,
      ref: e.requestId,
      retryable: e.retryable,
      fields: e.fields,
    };
  }
  const err = e as Error | undefined;
  if (err?.name === 'ChunkLoadError' || /dynamically imported module|Loading chunk|Importing a module script failed/i.test(err?.message ?? '')) {
    return { ...(COPY.CHUNK_LOAD_FAILED as { title: string; message: string }), code: 'CHUNK_LOAD_FAILED', retryable: true };
  }
  return { title: fallbackTitle, message: 'An unexpected error occurred. Please try again.', code: 'CLIENT_ERROR', retryable: true };
}

export const errorReference = (f: Pick<FriendlyError, 'code' | 'ref'>) => `Code: ${f.code}${f.ref ? ` · Ref: ${f.ref}` : ''}`;

// Avoid stacking identical toasts (e.g. several requests failing while offline).
const recent = new Map<string, number>();

/** Toast with a friendly title + message, the error code / reference, and an optional Retry. */
export function notifyError(e: unknown, opts: { title?: string; onRetry?: () => void } = {}) {
  const f = describeError(e, opts.title);
  const title = opts.title && !(e instanceof ApiError && ['OFFLINE', 'NETWORK_ERROR', 'SESSION_EXPIRED'].includes(e.code)) ? opts.title : f.title;
  const key = `${title}|${f.code}`;
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - 4000) return;
  recent.set(key, now);
  toast.error(title, {
    id: key,
    description: (
      <div>
        <div>{f.message}</div>
        <div className="mt-1 text-[11px] opacity-70 font-mono">{errorReference(f)}</div>
      </div>
    ),
    duration: f.retryable ? 8000 : 6000,
    action: opts.onRetry && f.retryable ? { label: 'Retry', onClick: opts.onRetry } : undefined,
  });
}
