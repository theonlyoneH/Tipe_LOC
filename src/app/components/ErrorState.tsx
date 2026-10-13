import { useState } from 'react';
import { AlertTriangle, Check, Copy, RefreshCw, WifiOff } from 'lucide-react';
import { describeError, errorReference } from '../lib/errors';

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
  className?: string;
}

/** Inline, friendly error with code/reference and a Retry button. */
export function ErrorState({ error, title, onRetry, retrying, compact, className = '' }: ErrorStateProps) {
  const f = describeError(error, title);
  const [copied, setCopied] = useState(false);
  const Icon = f.code === 'OFFLINE' || f.code === 'NETWORK_ERROR' ? WifiOff : AlertTriangle;
  const ref = errorReference(f);

  const copy = () =>
    navigator.clipboard?.writeText(`${f.title} - ${f.message} (${ref})`).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });

  return (
    <div role="alert" className={`bg-white border border-red-100 rounded-2xl ${compact ? 'p-4' : 'p-8'} text-center ${className}`}>
      <Icon className={`${compact ? 'w-7 h-7' : 'w-10 h-10'} text-red-400 mx-auto mb-2`} />
      <p className="font-semibold text-slate-900">{f.title}</p>
      <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">{f.message}</p>
      <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
        {onRetry && (
          <button onClick={onRetry} disabled={retrying} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} /> {retrying ? 'Retrying…' : 'Try again'}
          </button>
        )}
        <button onClick={copy} className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-600" title="Copy error details for support">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {ref}
        </button>
      </div>
    </div>
  );
}
