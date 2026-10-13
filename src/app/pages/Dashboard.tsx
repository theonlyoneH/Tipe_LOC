import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowDownRight, ArrowUpRight, MessageSquare, Newspaper, Target, ThumbsUp, Users } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { SourcingBadge } from '../components/SourcingStatus';
import { Skeleton } from '../components/PageSkeleton';
import { useAnalytics, useLeads, useNews } from '../lib/queries';
import { useSession } from '../lib/session';
import { CHANNELS, SIGNAL_STYLE, channelOf, flag, pct, timeAgo } from '../lib/utils';
import { ErrorState } from '../components/ErrorState';

const card = 'bg-white rounded-2xl shadow-sm p-6 border border-slate-200';

export function Dashboard() {
  const user = useSession((s) => s.user);
  const { data: leadsData, isLoading: leadsLoading, isError, error, refetch, isFetching } = useLeads();
  const { data: analytics } = useAnalytics();
  const { data: news = [] } = useNews(user?.industry ?? '');
  const leads = leadsData?.leads ?? [];

  const stats = useMemo(() => {
    const top = leads.slice(0, 50);
    const avg = (f: (l: (typeof leads)[number]) => number) => (top.length ? top.reduce((s, l) => s + f(l), 0) / top.length : 0);

    const byCountry = new Map<string, { n: number; score: number; news: number }>();
    for (const l of leads) {
      if (!l.country) continue;
      const c = byCountry.get(l.country) ?? { n: 0, score: 0, news: 0 };
      c.n += 1;
      c.score += l.dynamic_score;
      c.news += l.news_score - 0.5;
      byCountry.set(l.country, c);
    }
    const countries = [...byCountry.entries()]
      .map(([country, c]) => ({ country, count: c.n, score: Math.round((c.score / c.n) * 100), news: c.news / c.n }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const channelCounts = new Map<string, number>();
    for (const l of leads) {
      const ch = channelOf(l.preferred_channel);
      channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
    }
    const channels = [...channelCounts.entries()]
      .map(([ch, n]) => ({ name: CHANNELS[ch as keyof typeof CHANNELS].label, value: n, color: CHANNELS[ch as keyof typeof CHANNELS].color }))
      .sort((a, b) => b.value - a.value);

    const movers = [...leads]
      .filter((l) => l.news_reasons.length && l.rank_delta !== 0)
      .sort((a, b) => Math.abs(b.rank_delta) - Math.abs(a.rank_delta))
      .slice(0, 5);

    return {
      intent: avg((l) => l.intent_score),
      response: avg((l) => l.response_probability),
      countries,
      channels,
      movers,
    };
  }, [leads]);

  const marketNews = useMemo(() => {
    const leadCountries = new Set(leads.map((l) => l.country));
    return news.filter((a) => a.countries.some((c) => leadCountries.has(c))).slice(0, 5);
  }, [news, leads]);

  const loading = leadsLoading && !leadsData;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-1">Dashboard</h1>
          <p className="text-slate-500 text-sm">
            {user?.industry ? `${user.industry} ${user.category === 'importer' ? 'suppliers' : 'buyers'}` : 'Your pipeline'}, re-ranked live from{' '}
            {leadsData?.news_used ?? 0} market headlines{leadsData?.learned_from_swipes ? ` and ${leadsData.learned_from_swipes} of your swipes` : ''}.
          </p>
        </div>
        {leadsData && (
          <div className="flex items-center gap-2">
            <SourcingBadge sourcing={leadsData.sourcing} />
            <span className="text-xs text-slate-400">Updated {timeAgo(leadsData.generated_at)}</span>
          </div>
        )}
      </div>

      {isError && !leadsData && (
        <ErrorState compact error={error} title="Couldn't load your leads" onRetry={() => refetch()} retrying={isFetching} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <KPICard icon={Users} value={loading ? '…' : leadsData?.total_candidates ?? 0} label="Leads in pipeline" trend={loading ? '' : `Avg intent ${pct(stats.intent)}`} iconColor="bg-blue-100 text-blue-600" to="/approve" />
        <KPICard icon={ThumbsUp} value={analytics ? `${analytics.approval_rate}%` : '…'} label="Approval rate" trend={analytics ? `${analytics.decisions.approved} approved` : ''} iconColor="bg-green-100 text-green-600" to="/approved" />
        <KPICard icon={MessageSquare} value={analytics ? `${analytics.response_rate}%` : '…'} label="Reply rate" trend={analytics ? `${analytics.responded}/${analytics.contacted} replied` : ''} iconColor="bg-purple-100 text-purple-600" to="/conversations" />
        <KPICard icon={Target} value={loading ? '…' : pct(stats.response)} label="Predicted response" trend="Top 50 leads" iconColor="bg-orange-100 text-orange-600" to="/analytics" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* News-driven movers */}
        <section className={`${card} lg:col-span-3`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">News-driven ranking moves</h2>
            <Link to="/approve" className="text-sm text-blue-600 font-semibold hover:underline">Review leads →</Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : stats.movers.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No headlines are moving your leads right now.</p>
          ) : (
            <ul className="space-y-2">
              {stats.movers.map((l) => {
                const up = l.rank_delta > 0;
                return (
                  <li key={l.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                    <span className={`mt-0.5 shrink-0 inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg ${up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {Math.abs(l.rank_delta)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-slate-900 truncate">
                        {flag(l.country)} {l.company_name} <span className="text-slate-400 font-normal">· {l.match_percentage}% match</span>
                      </div>
                      <a href={l.news_reasons[0].url} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-blue-600 line-clamp-1">
                        {l.news_reasons[0].why}: {l.news_reasons[0].headline}
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Market news */}
        <section className={`${card} lg:col-span-2`}>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Newspaper className="w-5 h-5 text-blue-600" /> Signals in your markets</h2>
          {marketNews.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No headlines mention your lead markets yet.</p>
          ) : (
            <ul className="space-y-3">
              {marketNews.map((a) => {
                const s = SIGNAL_STYLE[a.signal];
                return (
                  <li key={a.id}>
                    <a href={a.url} target="_blank" rel="noreferrer" className="block group">
                      <div className={`text-[11px] font-semibold uppercase ${s.text}`}>{s.label} · {a.countries.slice(0, 3).join(', ')}</div>
                      <div className="text-sm text-slate-800 group-hover:text-blue-600 line-clamp-2">{a.headline}</div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className={card}>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Outreach funnel</h2>
          {/* CSS bars keep the landing page free of the charting bundle. */}
          <div className="space-y-3">
            {(analytics?.funnel ?? []).map((f) => {
              const max = Math.max(1, ...(analytics?.funnel ?? []).map((x) => x.count));
              return (
                <div key={f.stage}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-600">{f.stage}</span><span className="font-bold text-slate-900">{f.count}</span></div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-[width] duration-500" style={{ width: `${(f.count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            {!analytics && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-7" />)}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Top markets now</h2>
          {loading ? (
            <Skeleton className="h-48" />
          ) : stats.countries.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No leads yet for your industry.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {stats.countries.map((c) => (
                <div key={c.country} className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-center">
                  <div className="text-2xl">{flag(c.country)}</div>
                  <div className="text-sm font-bold text-slate-900 truncate">{c.country}</div>
                  <div className="text-xs text-blue-600 font-semibold">{c.score}% · {c.count} leads</div>
                  {Math.abs(c.news) > 0.02 && (
                    <div className={`text-[10px] font-semibold ${c.news > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {c.news > 0 ? '▲ news tailwind' : '▼ news headwind'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={card}>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Preferred channels</h2>
          {stats.channels.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No data yet.</p>
          ) : (
            <>
              <div className="flex h-3 rounded-full overflow-hidden mb-4">
                {stats.channels.map((c) => <div key={c.name} style={{ width: `${(c.value / leads.length) * 100}%`, backgroundColor: c.color }} title={c.name} />)}
              </div>
              <div className="space-y-2">
                {stats.channels.map((c) => (
                  <div key={c.name} className="flex items-center gap-3 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-slate-600 flex-1">{c.name}</span>
                    <span className="font-bold text-slate-900">{Math.round((c.value / leads.length) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
