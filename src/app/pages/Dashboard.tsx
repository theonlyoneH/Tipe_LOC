import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { TrendingUp, Users, Calendar, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { KPICard } from '../components/KPICard';

const API = "http://10.120.101.22:8005";

// Country → flag emoji map
const countryFlags: Record<string, string> = {
  Netherlands: '🇳🇱', Germany: '🇩🇪', USA: '🇺🇸', UAE: '🇦🇪',
  Singapore: '🇸🇬', UK: '🇬🇧', Japan: '🇯🇵', Australia: '🇦🇺',
  India: '🇮🇳', China: '🇨🇳', France: '🇫🇷', Canada: '🇨🇦',
  Brazil: '🇧🇷', Mexico: '🇲🇽', Italy: '🇮🇹', Spain: '🇪🇸',
  Sweden: '🇸🇪', Switzerland: '🇨🇭', 'South Korea': '🇰🇷',
  'Saudi Arabia': '🇸🇦', Poland: '🇵🇱', Turkey: '🇹🇷',
};

interface RawLead {
  _id: string;
  Buyer_ID?: string;
  Country?: string;
  Industry?: string;
  Revenue_Size_USD?: number;
  Team_Size?: number;
  Intent_Score?: number;
  Response_Probability?: number;
  Preferred_Channel?: string;
  Good_Payment_History?: number;
  Funding_Event?: number;
  DecisionMaker_Change?: number;
  Tariff_News?: number;
  Engagement_Spike?: number;
  SalesNav_ProfileVisits?: number;
  Certification?: string;
  status?: string;
}

interface DashStats {
  totalLeads: number;
  avgResponseRate: number;
  avgIntentScore: number;
  highIntentCount: number;
  fundingEventCount: number;
  topCountries: { country: string; score: number; flag: string }[];
  channelDist: { name: string; value: number; color: string }[];
  feed: { action: string; company: string; time: string }[];
  totalRevenue: number;
  pipeline: { stage: string; count: number }[];
}

export function Dashboard() {
  const { stats, leads, meetings } = useStore();
  const [dashStats, setDashStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndCompute = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const industry = user.industry || '';
        const userEmail = user.email || '';

        const params = new URLSearchParams({ industry });
        if (userEmail) params.set('user_email', userEmail);

        const res = await fetch(`${API}/leads?${params.toString()}`);
        const rawLeads: RawLead[] = await res.json();

        if (!Array.isArray(rawLeads) || rawLeads.length === 0) {
          setLoading(false);
          return;
        }

        // ── KPIs ──
        const totalLeads = rawLeads.length;
        const avgResponseRate =
          totalLeads > 0
            ? rawLeads.reduce((s, l) => s + (l.Response_Probability ?? 0), 0) / totalLeads
            : 0;
        const avgIntentScore =
          totalLeads > 0
            ? rawLeads.reduce((s, l) => s + (l.Intent_Score ?? 0), 0) / totalLeads
            : 0;
        const highIntentCount = rawLeads.filter(l => (l.Intent_Score ?? 0) >= 0.7).length;
        const fundingEventCount = rawLeads.filter(l => l.Funding_Event === 1).length;
        const totalRevenue = rawLeads.reduce((s, l) => s + (l.Revenue_Size_USD ?? 0), 0);

        // ── Top Countries (by avg intent score) ──
        const countryMap: Record<string, { total: number; count: number }> = {};
        rawLeads.forEach(l => {
          if (!l.Country) return;
          if (!countryMap[l.Country]) countryMap[l.Country] = { total: 0, count: 0 };
          countryMap[l.Country].total += l.Intent_Score ?? 0;
          countryMap[l.Country].count += 1;
        });
        const topCountries = Object.entries(countryMap)
          .map(([country, v]) => ({
            country,
            score: Math.round((v.total / v.count) * 100),
            flag: countryFlags[country] ?? '🌍',
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 6);

        // ── Channel Distribution ──
        const channelMap: Record<string, number> = {};
        rawLeads.forEach(l => {
          const ch = l.Preferred_Channel ?? 'Other';
          channelMap[ch] = (channelMap[ch] ?? 0) + 1;
        });
        const channelColors: Record<string, string> = {
          Email: '#3b82f6',
          LinkedIn: '#0a66c2',
          WhatsApp: '#25d366',
          Call: '#8b5cf6',
          Other: '#94a3b8',
        };
        const channelDist = Object.entries(channelMap)
          .map(([name, count]) => ({
            name,
            value: Math.round((count / totalLeads) * 100),
            color: channelColors[name] ?? '#94a3b8',
          }))
          .sort((a, b) => b.value - a.value);

        // ── Intelligence Feed (derived from real flags) ──
        const feed: { action: string; company: string; time: string }[] = [];

        // Leads with Funding events
        rawLeads
          .filter(l => l.Funding_Event === 1)
          .slice(0, 2)
          .forEach(l => feed.push({ action: 'Funding event detected', company: l.Buyer_ID ?? 'Unknown', time: 'Recently' }));

        // Leads with DecisionMaker change
        rawLeads
          .filter(l => l.DecisionMaker_Change === 1)
          .slice(0, 2)
          .forEach(l => feed.push({ action: 'Decision-maker changed', company: l.Buyer_ID ?? 'Unknown', time: 'Last 7 days' }));

        // Leads with very high Sales Nav visits
        rawLeads
          .filter(l => (l.SalesNav_ProfileVisits ?? 0) > 8000)
          .slice(0, 2)
          .forEach(l => feed.push({ action: 'High SalesNav engagement spike', company: l.Buyer_ID ?? 'Unknown', time: 'This week' }));

        // Top intent leads
        [...rawLeads]
          .sort((a, b) => (b.Intent_Score ?? 0) - (a.Intent_Score ?? 0))
          .slice(0, 2)
          .forEach(l => feed.push({ action: `High intent: ${Math.round((l.Intent_Score ?? 0) * 100)}%`, company: l.Buyer_ID ?? 'Unknown', time: 'Live' }));

        // ── Fetch approved leads for pipeline ──
        let approvedCount = 0;
        try {
          if (userEmail) {
            const approvedRes = await fetch(`${API}/approved-leads?user_email=${encodeURIComponent(userEmail)}`);
            const approvedData = await approvedRes.json();
            approvedCount = Array.isArray(approvedData) ? approvedData.length : 0;
          }
        } catch { /* ignore */ }

        const pendingCount = totalLeads; // /leads endpoint already excludes approved ones

        setDashStats({
          totalLeads,
          avgResponseRate,
          avgIntentScore,
          highIntentCount,
          fundingEventCount,
          topCountries,
          channelDist,
          feed: feed.slice(0, 6),
          totalRevenue,
          pipeline: [
            { stage: 'Pending', count: pendingCount },
            { stage: 'Approved', count: approvedCount },
            { stage: 'Meetings', count: meetings.filter(m => m.status === 'scheduled').length },
            { stage: 'Converted', count: meetings.filter(m => m.status === 'completed').length },
          ],
        });
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndCompute();
  }, []);

  const pipelineData = dashStats?.pipeline ?? [
    { stage: 'Pending', count: leads.filter(l => l.status === 'pending').length },
    { stage: 'Approved', count: leads.filter(l => l.status === 'approved').length },
    { stage: 'Meetings', count: meetings.filter(m => m.status === 'scheduled').length },
    { stage: 'Converted', count: meetings.filter(m => m.status === 'completed').length },
  ];

  const fmtM = (v: number) =>
    v >= 1_000_000_000
      ? `$${(v / 1_000_000_000).toFixed(1)}B`
      : v >= 1_000_000
        ? `$${(v / 1_000_000).toFixed(1)}M`
        : v >= 1_000
          ? `$${(v / 1_000).toFixed(0)}K`
          : `$${v}`;

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-1">Dashboard</h1>
        <p className="text-slate-500 text-sm">Real-time trade intelligence from your buyer database.</p>
      </div>

      {/* KPI Cards — real data when loaded, store fallbacks otherwise */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          icon={Users}
          value={loading ? '...' : dashStats?.totalLeads ?? stats.activeLeads}
          label="Total Leads"
          trend={loading ? '' : `${dashStats?.highIntentCount ?? 0} high intent`}
          iconColor="bg-blue-100 text-blue-600"
          delay={0.1}
        />
        <KPICard
          icon={TrendingUp}
          value={loading ? '...' : `${Math.round((isNaN(dashStats?.avgResponseRate ?? NaN) ? 0 : (dashStats?.avgResponseRate ?? 0)) * 100)}%`}
          label="Avg Response Rate"
          trend={loading ? '' : `Intent: ${Math.round((dashStats?.avgIntentScore ?? 0) * 100)}%`}
          iconColor="bg-purple-100 text-purple-600"
          delay={0.2}
        />
        <KPICard
          icon={Calendar}
          value={loading ? '...' : dashStats?.fundingEventCount ?? stats.meetingsScheduled}
          label="Funding Events"
          trend="Recent signals"
          iconColor="bg-green-100 text-green-600"
          delay={0.3}
        />
        <KPICard
          icon={Target}
          value={loading ? '...' : fmtM(dashStats?.totalRevenue ?? 0)}
          label="Total Buyer Revenue"
          trend="Combined portfolio"
          iconColor="bg-orange-100 text-orange-600"
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-6">Pipeline Overview</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={pipelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="stage" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Global Buyer Intent — real countries from DB */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-6">Global Buyer Intent</h2>
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {(dashStats?.topCountries.length ? dashStats.topCountries : [
                { country: 'Netherlands', score: 83, flag: '🇳🇱' },
                { country: 'Germany', score: 77, flag: '🇩🇪' },
                { country: 'USA', score: 74, flag: '🇺🇸' },
              ]).map((item, idx, arr) => (
                <div
                  key={item.country}
                  className="p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center transition-transform hover:scale-105"
                  style={{ backgroundColor: `rgba(59,130,246,${0.05 + 0.15 * (arr.length - idx) / arr.length})` }}
                >
                  <span className="text-2xl mb-1">{item.flag}</span>
                  <span className="text-sm font-bold text-slate-900">{item.country}</span>
                  <span className="text-xs font-semibold text-blue-600">{item.score} Score</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Intelligence Feed — derived from real fields */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6 border border-slate-200 overflow-hidden"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-6">Intelligence Feed</h2>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {(dashStats?.feed.length ? dashStats.feed : [
                { action: 'Fetching live signals...', company: 'Connecting to database', time: '' },
              ]).map((activity, index) => (
                <motion.div
                  key={activity.company + index}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 text-sm truncate">{activity.action}</div>
                    <div className="text-xs text-slate-500 truncate">{activity.company}</div>
                  </div>
                  <div className="text-xs text-slate-400 font-medium flex-shrink-0">{activity.time}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Channel Distribution — real Preferred_Channel counts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-6">Channels</h2>
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={dashStats?.channelDist.length ? dashStats.channelDist : [
                    { name: 'Email', value: 45, color: '#3b82f6' },
                    { name: 'LinkedIn', value: 30, color: '#0a66c2' },
                    { name: 'WhatsApp', value: 15, color: '#25d366' },
                    { name: 'Call', value: 10, color: '#8b5cf6' },
                  ]}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(dashStats?.channelDist ?? []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full mt-4 space-y-2">
              {(dashStats?.channelDist.length ? dashStats.channelDist : [
                { name: 'Email', value: 45, color: '#3b82f6' },
                { name: 'LinkedIn', value: 30, color: '#0a66c2' },
                { name: 'WhatsApp', value: 15, color: '#25d366' },
                { name: 'Call', value: 10, color: '#8b5cf6' },
              ]).map(ch => (
                <div key={ch.name} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ch.color }} />
                  <span className="text-xs text-slate-600 flex-1">{ch.name}</span>
                  <span className="text-xs font-bold text-slate-900">{ch.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}