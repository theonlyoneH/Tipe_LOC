import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, MessageSquare, Search, Shield } from 'lucide-react';
import { EmptyState, Skeleton } from '../components/PageSkeleton';
import { useApprovedLeads } from '../lib/queries';
import { CHANNELS, STAGE_LABEL, channelOf, flag, formatMoney, pct, timeAgo } from '../lib/utils';
import { ErrorState } from '../components/ErrorState';

export function ApprovedLeads() {
  const { data: leads = [], isLoading, isError, error, refetch, isFetching } = useApprovedLeads();
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(
    () =>
      q
        ? leads.filter((l) => [l.company_name, l.industry, l.country].some((v) => (v || '').toLowerCase().includes(q)))
        : leads,
    [leads, q],
  );

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-1">Approved Leads</h1>
        <p className="text-slate-600">{leads.length} leads approved. Outreach starts automatically on approval.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="search"
          placeholder="Search by company, industry, or country…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isError && !leads.length ? (
        <ErrorState error={error} title="Couldn't load approved leads" onRetry={() => refetch()} retrying={isFetching} />
      ) : isLoading && !leads.length ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={leads.length ? 'No leads match your search' : 'No approved leads yet'}>
          {!leads.length && <Link to="/approve" className="text-blue-600 font-semibold">Start reviewing leads →</Link>}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((lead) => {
            const channel = CHANNELS[lead.outreach_channel ?? channelOf(lead.preferred_channel)];
            return (
              <div key={lead.id} className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-slate-900 truncate">{lead.company_name}</h3>
                      {lead.trust_verified && <Shield className="w-5 h-5 text-green-500 fill-green-100 shrink-0" />}
                    </div>
                    <p className="text-slate-600 text-sm">{flag(lead.country)} {lead.country || '—'} · {lead.industry}</p>
                  </div>
                  {lead.match_percentage ? (
                    <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-3 py-1.5 rounded-xl text-sm font-bold shrink-0">{lead.match_percentage}% match</div>
                  ) : null}
                </div>

                <dl className="grid grid-cols-3 gap-3 text-sm mb-4">
                  <div><dt className="text-slate-500 text-xs">Revenue</dt><dd className="font-semibold">{formatMoney(lead.revenue_usd)}</dd></div>
                  <div><dt className="text-slate-500 text-xs">Intent</dt><dd className="font-semibold">{lead.intent_score ? pct(lead.intent_score) : '—'}</dd></div>
                  <div><dt className="text-slate-500 text-xs">Approved</dt><dd className="font-semibold">{timeAgo(lead.approved_at) || '—'}</dd></div>
                </dl>

                <div className="flex items-center gap-2 pt-4 border-t border-slate-200">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${channel.badge}`}>
                    <channel.icon className="w-3.5 h-3.5" /> {channel.label}
                  </span>
                  <span className="text-xs text-slate-500 flex-1">{lead.outreach_stage ? STAGE_LABEL[lead.outreach_stage] ?? lead.outreach_stage : 'No outreach yet'}</span>
                  {lead.conversation_id && (
                    <Link to="/conversations" state={{ openId: lead.conversation_id }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                      <MessageSquare className="w-4 h-4" /> Open outreach
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
