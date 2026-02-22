import { useStore } from '../store/useStore';
import { motion } from 'motion/react';
import { TrendingUp, Users, CheckCircle, MessageSquare, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

export function Analytics() {
  const { leads, stats } = useStore();

  // ICP Match Distribution
  const icpData = [
    { range: '90-100%', count: leads.filter(l => l.match_percentage >= 90).length, color: '#10b981' },
    { range: '80-89%', count: leads.filter(l => l.match_percentage >= 80 && l.match_percentage < 90).length, color: '#3b82f6' },
    { range: '70-79%', count: leads.filter(l => l.match_percentage >= 70 && l.match_percentage < 80).length, color: '#f59e0b' },
    { range: '60-69%', count: leads.filter(l => l.match_percentage >= 60 && l.match_percentage < 70).length, color: '#ef4444' },
  ];

  // Channel Performance
  const channelPerformance = [
    { channel: 'Email', sent: 145, responded: 89, meetings: 34 },
    { channel: 'LinkedIn', sent: 98, responded: 67, meetings: 28 },
    { channel: 'WhatsApp', sent: 56, responded: 42, meetings: 15 },
    { channel: 'Calls', sent: 34, responded: 28, meetings: 12 },
  ];

  // Top Performing Segments
  const topSegments = [
    { industry: 'Manufacturing', matches: 28, conversionRate: 34 },
    { industry: 'Technology', matches: 24, conversionRate: 31 },
    { industry: 'Agriculture', matches: 18, conversionRate: 28 },
    { industry: 'Textiles', matches: 15, conversionRate: 25 },
    { industry: 'Electronics', matches: 12, conversionRate: 22 },
  ];

  // Trend data (mock weekly data)
  const trendData = [
    { week: 'Week 1', leads: 45, approved: 28, meetings: 12 },
    { week: 'Week 2', leads: 52, approved: 35, meetings: 15 },
    { week: 'Week 3', leads: 48, approved: 31, meetings: 18 },
    { week: 'Week 4', leads: 60, approved: 42, meetings: 22 },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Analytics</h1>
        <p className="text-slate-600">Deep insights into your trade intelligence performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white"
        >
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-4xl font-bold mb-1">{leads.length}</div>
          <div className="text-sm opacity-90">Total Leads</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white"
        >
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-4xl font-bold mb-1">{stats.approvalRate.toFixed(0)}%</div>
          <div className="text-sm opacity-90">Approval Rate</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white"
        >
          <div className="flex items-center justify-between mb-4">
            <MessageSquare className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-4xl font-bold mb-1">{stats.responseRate.toFixed(0)}%</div>
          <div className="text-sm opacity-90">Response Rate</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-lg p-6 text-white"
        >
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-4xl font-bold mb-1">{stats.conversionRate.toFixed(0)}%</div>
          <div className="text-sm opacity-90">Meeting Conversion</div>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ICP Match Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
        >
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">ICP Match Distribution</h2>
          </div>
          <div className="flex items-center justify-between">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie
                  data={icpData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {icpData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {icpData.map((entry) => (
                <div key={entry.range} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm text-slate-600 flex-1">{entry.range}</span>
                  <span className="text-sm font-semibold text-slate-900">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Channel Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
        >
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Channel Performance</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={channelPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="channel" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: 'none', 
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Bar dataKey="sent" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="responded" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="meetings" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-slate-400 rounded" />
              <span className="text-xs text-slate-600">Sent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span className="text-xs text-slate-600">Responded</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span className="text-xs text-slate-600">Meetings</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Trend Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900">Performance Trends</h2>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="week" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1e293b', 
                border: 'none', 
                borderRadius: '8px',
                color: '#fff'
              }}
            />
            <Line type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="meetings" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Top Performing Segments */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200"
      >
        <h2 className="text-xl font-bold text-slate-900 mb-6">Top Performing Segments</h2>
        <div className="space-y-4">
          {topSegments.map((segment, index) => (
            <div key={segment.industry} className="flex items-center gap-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{segment.industry}</div>
                <div className="text-sm text-slate-600">{segment.matches} matches</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{segment.conversionRate}%</div>
                <div className="text-xs text-slate-600">Conversion</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
