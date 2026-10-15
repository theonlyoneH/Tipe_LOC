import { motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, Building2, DollarSign, ExternalLink, Factory, Globe, Newspaper, Shield, ShoppingCart, Sparkles, TrendingUp, Users } from 'lucide-react';
import type { Lead } from '../lib/types';
import { useLeadInsight } from '../lib/queries';
import { CHANNELS, channelOf, flag, formatMoney, pct } from '../lib/utils';

export type SwipeDirection = 'left' | 'right' | 'up';

const ScoreRing = ({ score }: { score: number }) => {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const color = score >= 80 ? '#22c55e' : score >= 65 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-16 h-16 lg:w-[72px] lg:h-[72px] shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} stroke="#f1f5f9" strokeWidth="8" fill="none" />
        <circle
          cx="40" cy="40" r={radius} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-slate-900 leading-none">{score}%</span>
        <span className="text-[9px] font-bold text-slate-500 uppercase">Match</span>
      </div>
    </div>
  );
};

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`px-3 py-2 rounded-xl border ${tone}`}>
      <div className="text-[11px] font-medium text-slate-600">{label}</div>
      <div className="text-lg font-bold tabular-nums leading-tight">{value}</div>
    </div>
  );
}

export function LeadCardBody({ lead, isTop }: { lead: Lead; isTop: boolean }) {
  const { data: insight, isLoading: insightLoading } = useLeadInsight(isTop ? lead.id : undefined);
  const channel = CHANNELS[channelOf(lead.preferred_channel)];
  const newsDelta = Math.round((lead.news_score - 0.5) * 200);

  return (
    <div className="w-full h-full bg-white rounded-[32px] shadow-xl p-4 lg:p-6 flex flex-col border border-slate-200 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">{lead.company_name}</h2>
            {lead.trust_verified && <Shield className="w-6 h-6 text-green-500 fill-green-50 shrink-0" aria-label="Good payment history" />}
          </div>
          <p className="text-sm text-slate-500 font-medium">
            {flag(lead.country)} {lead.city ? `${lead.city}, ` : ''}{lead.country || 'Unknown'} · {lead.industry}
          </p>
          {lead.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1" title={lead.description}>{lead.description}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {lead.role_label && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${lead.lead_role === 'buyer' ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-800'}`}
                title={lead.lead_role === 'buyer' ? 'This company buys what you sell' : 'This company makes what you buy'}
              >
                {lead.lead_role === 'buyer' ? <ShoppingCart className="w-3.5 h-3.5" /> : <Factory className="w-3.5 h-3.5" />} {lead.role_label}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${channel.badge}`}>
              <channel.icon className="w-3.5 h-3.5" /> {channel.label}
            </span>
            {lead.rank_delta !== 0 && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${lead.rank_delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {lead.rank_delta > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {Math.abs(lead.rank_delta)} places {lead.rank_delta > 0 ? 'up' : 'down'} today
              </span>
            )}
            {lead.skipped && <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-600">Skipped before</span>}
            {lead.is_real && lead.source_url && (
              <a href={lead.source_url} target="_blank" rel="noreferrer" onPointerDownCapture={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100" title="Real company - open the source record">
                <Globe className="w-3.5 h-3.5" /> Real company · {lead.data_source}
              </a>
            )}
            {lead.contact?.website && (
              <a href={lead.contact.website} target="_blank" rel="noreferrer" onPointerDownCapture={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">
                <ExternalLink className="w-3.5 h-3.5" /> Website
              </a>
            )}
          </div>
        </div>
        <ScoreRing score={lead.match_percentage} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Metric label="Intent" value={pct(lead.intent_score)} tone="bg-blue-50 border-blue-100 text-blue-700" />
        <Metric label="Reply odds" value={pct(lead.response_probability)} tone="bg-purple-50 border-purple-100 text-purple-700" />
        <Metric
          label="News impact"
          value={`${newsDelta > 0 ? '+' : ''}${newsDelta}`}
          tone={newsDelta > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : newsDelta < 0 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-slate-50 border-slate-100 text-slate-600'}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 rounded-lg"><DollarSign className="w-4 h-4 text-slate-500" /><span className="font-semibold">{formatMoney(lead.revenue_usd)}</span></div>
        <div className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 rounded-lg"><Users className="w-4 h-4 text-slate-500" /><span className="font-semibold">{lead.team_size ? lead.team_size.toLocaleString() : '—'}</span></div>
        <div className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 rounded-lg truncate"><Building2 className="w-4 h-4 text-slate-500 shrink-0" /><span className="font-semibold truncate">{lead.certification || 'No cert.'}</span></div>
      </div>

      {/* Scrollable detail. Pointer events here don't start a drag, so it can scroll on touch. */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1" onPointerDownCapture={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-4 rounded-xl border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" /> Why this lead, right now
          </h3>
          {isTop && insightLoading ? (
            <div className="space-y-2">
              <div className="h-3 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 bg-slate-200 rounded animate-pulse w-4/5" />
            </div>
          ) : (
            <p className="text-sm text-slate-700 leading-relaxed">{insight?.insight || lead.ai_reasoning}</p>
          )}
          {lead.preference_note && <p className="text-xs text-blue-700 mt-2">{lead.preference_note}</p>}
        </div>

        {lead.news_reasons.length > 0 && (
          <div className="p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Newspaper className="w-3.5 h-3.5" /> Live news affecting this lead</h3>
            <ul className="space-y-2">
              {lead.news_reasons.map((r) => (
                <li key={r.url || r.headline} className="text-sm flex gap-2">
                  <span className={`shrink-0 font-bold ${r.impact >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{r.impact >= 0 ? '▲' : '▼'}</span>
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-slate-700 hover:text-blue-600">
                    <span className="font-medium">{r.why}.</span> {r.headline}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {lead.score_breakdown?.length > 0 && (
          <div className="p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">How it was ranked</h3>
            <ul className="space-y-1.5">
              {lead.score_breakdown.map((b, i) => {
                const isBase = i === 0;
                const v = isBase ? b.delta : b.delta * 100;
                return (
                  <li key={b.label} className="flex items-center gap-2 text-xs">
                    <span className="w-36 shrink-0 text-slate-600 truncate">{b.label}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isBase ? 'bg-slate-400' : b.delta >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, isBase ? b.delta * 100 : Math.abs(v) * 4)}%` }}
                      />
                    </div>
                    <span className={`w-12 text-right font-semibold tabular-nums ${isBase ? 'text-slate-700' : b.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isBase ? `${Math.round(v * 100)}` : `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
            {lead.model_probability != null && (
              <p className="text-[11px] text-slate-500 mt-2">Your random forest predicts a {Math.round(lead.model_probability * 100)}% chance you'd approve this lead.</p>
            )}
          </div>
        )}

        {lead.signals.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Buying signals</h3>
            <div className="flex flex-wrap gap-2">
              {lead.signals.map((s) => <span key={s} className="text-xs bg-white border border-slate-200 rounded-full px-2.5 py-1 text-slate-700">{s}</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SwipeCardProps {
  lead: Lead;
  onSwipe: (direction: SwipeDirection) => void;
}

export function SwipeCard({ lead, onSwipe }: SwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-14, 14]);
  const approveOpacity = useTransform(x, [30, 120], [0, 1]);
  const rejectOpacity = useTransform(x, [-120, -30], [1, 0]);
  const skipOpacity = useTransform(y, [-120, -30], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.y < -120 && Math.abs(offset.y) > Math.abs(offset.x)) return onSwipe('up');
    if (offset.x > 120 || velocity.x > 700) return onSwipe('right');
    if (offset.x < -120 || velocity.x < -700) return onSwipe('left');
  };

  return (
    <motion.div
      drag
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      style={{ x, y, rotate }}
      className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
    >
      <motion.div style={{ opacity: approveOpacity }} className="pointer-events-none absolute top-8 right-8 bg-green-500 text-white px-6 py-3 rounded-2xl font-black text-xl rotate-12 z-10 border-4 border-white shadow-xl">
        ✓ APPROVE
      </motion.div>
      <motion.div style={{ opacity: rejectOpacity }} className="pointer-events-none absolute top-8 left-8 bg-red-500 text-white px-6 py-3 rounded-2xl font-black text-xl -rotate-12 z-10 border-4 border-white shadow-xl">
        ✗ REJECT
      </motion.div>
      <motion.div style={{ opacity: skipOpacity }} className="pointer-events-none absolute top-8 left-1/2 -translate-x-1/2 bg-slate-700 text-white px-6 py-3 rounded-2xl font-black text-xl z-10 border-4 border-white shadow-xl">
        SKIP
      </motion.div>
      <LeadCardBody lead={lead} isTop />
    </motion.div>
  );
}
