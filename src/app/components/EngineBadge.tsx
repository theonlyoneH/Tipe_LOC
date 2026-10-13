import { useState } from 'react';
import { BrainCircuit, ChevronDown } from 'lucide-react';
import type { RankingEngine, RegimeName } from '../lib/types';

export const REGIME_STYLE: Record<RegimeName, { label: string; cls: string; dot: string }> = {
  calm: { label: 'Calm market', cls: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  active: { label: 'Active news', cls: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  boom: { label: 'Boom market', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  shock: { label: 'Market shock', cls: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

export function EngineBadge({ engine }: { engine: RankingEngine }) {
  const [open, setOpen] = useState(false);
  const regime = REGIME_STYLE[engine.regime.name] ?? REGIME_STYLE.active;
  const base = engine.pipeline[0];
  const rf = engine.pipeline.find((p) => p.name === 'random_forest');

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-white/90 backdrop-blur border border-slate-200 shadow-sm hover:bg-white"
        aria-expanded={open}
      >
        <BrainCircuit className="w-4 h-4 text-blue-600" />
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${regime.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${regime.dot}`} /> {regime.label}
        </span>
        <span className="text-slate-600 hidden sm:inline">{rf ? 'Random forest' : 'Baseline model'} + {engine.pipeline.length - 1} layers</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white rounded-xl border border-slate-200 shadow-xl p-4 z-30 text-sm space-y-3">
          <div>
            <div className="font-bold text-slate-900">Ranking engine</div>
            {engine.notes.map((n) => <p key={n} className="text-xs text-slate-600 mt-1">{n}</p>)}
          </div>
          <ol className="space-y-1">
            {engine.pipeline.map((p, i) => (
              <li key={p.name} className="flex items-start gap-2 text-xs">
                <span className="w-5 h-5 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold">{i + 1}</span>
                <span className={`pt-0.5 ${p === base ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{p.label}</span>
              </li>
            ))}
          </ol>
          {rf?.top_features && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">What your model learned to weigh</div>
              {rf.top_features.slice(0, 4).map((f) => (
                <div key={f.feature} className="flex items-center gap-2 text-xs mb-1">
                  <span className="w-28 text-slate-600 capitalize truncate">{f.feature}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, f.importance * 250)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!rf && (
            <p className="text-xs text-slate-500">
              A random forest takes over once you have a few approvals and rejections ({engine.feedback.decisions} so far).
            </p>
          )}
          {engine.feedback.top_reject_reasons.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">You mostly reject because</div>
              <div className="flex flex-wrap gap-1">
                {engine.feedback.top_reject_reasons.map((r) => (
                  <span key={r.reason} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700">{r.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
