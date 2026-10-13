import { AlertCircle } from 'lucide-react';
import { describeError, errorReference } from '../lib/errors';

const LABELS: Record<string, string> = { email: 'Email', password: 'Password', category: 'Account type', industry: 'Industry', country: 'Country' };

/** Inline form error: friendly message, per-field problems, and the error code/reference. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const f = describeError(error);
  const fields = Object.entries(f.fields ?? {});
  return (
    <div role="alert" className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
      <div className="flex gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{f.title}</p>
          {fields.length > 1 ? (
            <ul className="mt-1 space-y-0.5">
              {fields.map(([k, v]) => <li key={k}><span className="font-medium">{LABELS[k] ?? k}:</span> {v}</li>)}
            </ul>
          ) : (
            <p>{f.message}</p>
          )}
          <p className="mt-1 text-[11px] font-mono text-red-400">{errorReference(f)}</p>
        </div>
      </div>
    </div>
  );
}
