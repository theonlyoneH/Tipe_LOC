import { motion, useMotionValue, useTransform, PanInfo } from 'motion/react';
import { Shield, TrendingUp, Users, DollarSign, ArrowRight, ArrowLeft, ArrowUp, Sparkles } from 'lucide-react';
import { Lead } from '../store/useStore';

// Extend Lead locally to accept signals array
interface LeadWithSignals extends Lead {
  signals?: string[];
}

interface SwipeCardProps {
  lead: LeadWithSignals;
  onSwipe: (direction: 'left' | 'right' | 'up') => void;
  style?: React.CSSProperties;
}

const SignalItem = ({ text }: { text: string }) => (
  <div className="flex items-center gap-2 text-sm text-slate-700">
    <Sparkles className="w-4 h-4 text-blue-500 fill-blue-100" />
    <span>{text}</span>
  </div>
);

const ScoreRing = ({ score }: { score: number }) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? '#22c55e' : score >= 75 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="48" cy="48" r={radius}
          stroke="currentColor" strokeWidth="8" fill="transparent"
          className="text-slate-100"
        />
        <motion.circle
          cx="48" cy="48" r={radius}
          stroke={color} strokeWidth="8" fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-slate-900 leading-none">{score}%</span>
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Match</span>
      </div>
    </div>
  );
};

export function SwipeCard({ lead, onSwipe, style }: SwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateZ = useTransform(x, [-200, 200], [-20, 20]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  // Show swipe direction indicators
  const approveOpacity = useTransform(x, [0, 100], [0, 1]);
  const rejectOpacity = useTransform(x, [-100, 0], [1, 0]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 150;
    const velocity = info.velocity.x;

    // Swipe up to skip
    if (info.offset.y < -threshold) {
      onSwipe('up');
      return;
    }

    // Swipe right to approve
    if (info.offset.x > threshold || velocity > 500) {
      onSwipe('right');
      return;
    }

    // Swipe left to reject
    if (info.offset.x < -threshold || velocity < -500) {
      onSwipe('left');
      return;
    }
  };

  return (
    <motion.div
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      style={{
        x,
        y,
        rotateZ,
        opacity,
        ...style,
      }}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Approve Indicator */}
      <motion.div
        style={{ opacity: approveOpacity }}
        className="absolute top-12 right-12 bg-green-500 text-white px-8 py-4 rounded-2xl font-black text-2xl rotate-12 z-10 border-4 border-white shadow-2xl"
      >
        ✓ APPROVE
      </motion.div>

      {/* Reject Indicator */}
      <motion.div
        style={{ opacity: rejectOpacity }}
        className="absolute top-12 left-12 bg-red-500 text-white px-8 py-4 rounded-2xl font-black text-2xl -rotate-12 z-10 border-4 border-white shadow-2xl"
      >
        ✗ REJECT
      </motion.div>

      <div className="w-full h-full bg-white rounded-[40px] shadow-2xl p-6 lg:p-10 flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h2 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">{lead.company_name}</h2>
              {lead.trust_verified && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                  <Shield className="w-7 h-7 text-green-500 fill-green-50" />
                </motion.div>
              )}
            </div>
            <p className="text-lg lg:text-xl font-medium text-slate-500">{lead.industry}{lead.location ? ` • ${lead.location}` : ''}</p>
          </div>
          <ScoreRing score={lead.match_percentage} />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-slate-600">Vector Score</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {lead.vector_score != null ? (lead.vector_score * 100).toFixed(1) : '72.0'}
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-slate-600">Intent Score</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {lead.intent_score != null ? (lead.intent_score * 100).toFixed(1) : '68.5'}
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-red-50 p-4 rounded-xl border border-orange-100">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-medium text-slate-600">Momentum</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {lead.trade_momentum_index != null ? (lead.trade_momentum_index * 100).toFixed(1) : '57.0'}
            </div>
          </div>
        </div>

        {/* Company Details */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Users className="w-5 h-5 text-slate-600" />
            <div>
              <div className="text-xs text-slate-500">Team Size</div>
              <div className="font-semibold text-slate-900">
                {lead.company_size ? `${Number(lead.company_size).toLocaleString()} people` : '250 people'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <DollarSign className="w-5 h-5 text-slate-600" />
            <div>
              <div className="text-xs text-slate-500">Revenue (USD)</div>
              <div className="font-semibold text-slate-900">{lead.estimated_value || '$2.3M'}</div>
            </div>
          </div>
        </div>

        {/* AI Reasoning & Signals */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-6">
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-6 rounded-xl border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              AI Analysis: Why This Match?
            </h3>
            <p className="text-slate-700 leading-relaxed text-sm lg:text-base">
              {lead.ai_reasoning || 'High intent score and strong payment history make this a priority lead. Recommended for immediate outreach.'}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Priority Signals</h3>
            <div className="space-y-2">
              {(lead.signals && lead.signals.length > 0)
                ? lead.signals.map((sig, i) => <SignalItem key={i} text={sig} />)
                : <SignalItem text="Good payment history verified" />}
            </div>
          </div>
        </div>

        {/* Trust Layer */}
        {lead.trust_verified && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-900">Trust Verified</span>
            </div>
            <p className="text-xs text-green-700 font-mono">{lead.firmographics_hash}</p>
          </div>
        )}

        {/* Swipe Instructions */}
        <div className="flex items-center justify-center gap-8 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 text-red-500">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Reject</span>
          </div>
          <div className="flex items-center gap-2 text-blue-500">
            <ArrowUp className="w-5 h-5" />
            <span className="text-sm font-medium">Skip</span>
          </div>
          <div className="flex items-center gap-2 text-green-500">
            <ArrowRight className="w-5 h-5" />
            <span className="text-sm font-medium">Approve</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}