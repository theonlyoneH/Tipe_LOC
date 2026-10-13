import { Database, Globe2, Loader2, TriangleAlert } from 'lucide-react';
import type { Sourcing } from '../lib/types';
import { timeAgo } from '../lib/utils';

const STAGE: Record<string, string> = {
  queued: 'Starting the scan…',
  discovering: 'Scanning open company registries worldwide…',
  running: 'Scanning open company registries worldwide…',
  enriching: 'Verifying companies and finding business contacts…',
};

/** Compact pill: demo dataset vs live scraped leads (with progress). */
export function SourcingBadge({ sourcing }: { sourcing?: Sourcing }) {
  if (!sourcing) return null;
  if (sourcing.mode === 'demo') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800" title="This test account uses the bundled demo dataset">
        <Database className="w-3 h-3" /> Demo data
      </span>
    );
  }
  const active = ['queued', 'running', 'enriching'].includes(sourcing.status);
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800"
      title={`Real companies from Wikidata + GLEIF + company websites${sourcing.updated_at ? ` · updated ${timeAgo(sourcing.updated_at)}` : ''}`}
    >
      {active ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe2 className="w-3 h-3" />}
      Live · {sourcing.found ?? 0} companies{active && sourcing.status === 'enriching' ? ` · ${sourcing.enriched ?? 0} checked` : ''}
    </span>
  );
}

/** Full-card state shown while a brand-new user's leads are being gathered. */
export function SourcingPanel({ sourcing, industry }: { sourcing?: Sourcing; industry?: string }) {
  if (sourcing?.status === 'failed') {
    return (
      <div className="text-center max-w-md">
        <TriangleAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-1">Couldn't reach the company registries</h2>
        <p className="text-sm text-slate-600">We'll retry automatically. You can also try a broader industry name in your profile.</p>
      </div>
    );
  }
  if (sourcing?.status === 'done') {
    return (
      <div className="text-center max-w-md">
        <Globe2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-1">No companies found for "{industry}"</h2>
        <p className="text-sm text-slate-600">Try a broader industry in your profile (e.g. "Textiles" instead of a specific product).</p>
      </div>
    );
  }
  return (
    <div className="text-center max-w-md">
      <div className="relative w-16 h-16 mx-auto mb-4">
        <Globe2 className="w-16 h-16 text-blue-500" />
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin absolute -right-1 -bottom-1 bg-white rounded-full" />
      </div>
      <h2 className="text-xl font-bold mb-1">Finding real {industry} companies</h2>
      <p className="text-sm text-slate-600">{STAGE[sourcing?.stage ?? 'queued'] ?? STAGE.queued}</p>
      {!!sourcing?.found && <p className="text-sm font-semibold text-blue-700 mt-2">{sourcing.found} companies found so far</p>}
      <p className="text-xs text-slate-400 mt-3">Sources: Wikidata (open company data), GLEIF legal-entity registry, public company websites.</p>
    </div>
  );
}
