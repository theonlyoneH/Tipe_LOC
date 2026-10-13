import { useMemo } from 'react';
import { BarChart3, CheckCircle, MessageSquare, PieChart as PieIcon, TrendingUp, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '../components/PageSkeleton';
import { useAnalytics, useLeads } from '../lib/queries';
import { flag } from '../lib/utils';
import { ErrorState } from '../components/ErrorState';

const card = 'bg-white rounded-2xl shadow-sm p-6 border border-slate-200';
const tooltip = { contentStyle: { backgroundColor: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' } };

const BUCKETS = [
  { range: '80-100%', min: 80, color: '#10b981' },
  { range: '70-79%', min: 70, color: '#3b82f6' },
  { range: '60-69%', min: 60, color: '#f59e0b' },
  { range: '<60%', min: 0, color: '#ef4444' },
];

export function Analytics() {
  const { data: a, isLoading, isError, error, refetch, isFetching } = useAnalytics();
  const { data: leadsData } = useLeads();

  const icp = useMemo(() => {
    const counts = BUCKETS.map((b) => ({ ...b, count: 0 }));
    for (const l of leadsData?.leads ?? []) {
      counts.find((b) => l.match_percentage >= b.min)!.count += 1;
    }
    return counts;
  }, [leadsData]);

  if (isError && !a) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <ErrorState error={error} title="Couldn't load analytics" onRetry={() => refetch()} retrying={isFetching} />
      </div>
    );
  }

  if (isLoading && !a) {
    return (
      <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const kpis = [
    { label: 'Leads in pipeline', value: leadsData?.total_candidates ?? '—', icon: Users, tone: 'from-blue-500 to-blue-600' },
    { label: 'Approval rate', value: `${a?.approval_rate ?? 0}%`, icon: CheckCircle, tone: 'from-green-500 to-green-600' },
    { label: 'Reply rate', value: `${a?.response_rate ?? 0}%`, icon: MessageSquare, tone: 'from-purple-500 to-purple-600' },
    { label: 'Meeting conversion', value: `${a?.meeting_conversion ?? 0}%`, icon: TrendingUp, tone: 'from-orange-500 to-orange-600' },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-1">Analytics</h1>
        <p className="text-slate-600">Computed from your swipes, outreach conversations and meetings.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`bg-gradient-to-br ${tone} rounded-2xl shadow-sm p-5 text-white`}>
            <Icon className="w-7 h-7 opacity-80 mb-3" />
            <div className="text-3xl lg:text-4xl font-bold mb-1 tabular-nums">{value}</div>
            <div className="text-sm opacity-90">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className={card}>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><PieIcon className="w-5 h-5 text-blue-600" /> Live match distribution</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie data={icp} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="count">
                  {icp.map((e) => <Cell key={e.range} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {icp.map((e) => (
                <div key={e.range} className="flex items-center gap-3 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
                  <span className="text-slate-600 flex-1">{e.range}</span>
                  <span className="font-semibold text-slate-900">{e.count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={card}>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-600" /> Channel performance</h2>
          {a?.channels.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={a.channels}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="channel" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} width={28} />
                <Tooltip {...tooltip} cursor={{ fill: '#f1f5f9' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="contacted" name="Contacted" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="responded" name="Replied" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="meetings" name="Meetings" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500 py-16 text-center">Approve leads to start outreach and see channel results.</p>
          )}
        </section>
      </div>

      <section className={card}>
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600" /> Weekly activity</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={a?.weekly ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="week" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} width={28} />
            <Tooltip {...tooltip} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="approved" name="Approved" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="rejected" name="Rejected" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="conversations" name="Conversations" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="meetings" name="Meetings" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Top markets by approvals</h2>
        {a?.segments.length ? (
          <div className="space-y-3">
            {a.segments.map((s, i) => (
              <div key={s.segment} className="flex items-center gap-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">{i + 1}</div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{flag(s.segment)} {s.segment}</div>
                  <div className="text-sm text-slate-600">{s.approved} approved · {s.replies} replied</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{s.reply_rate}%</div>
                  <div className="text-xs text-slate-600">Reply rate</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-6 text-center">No approvals yet.</p>
        )}
      </section>
    </div>
  );
}
