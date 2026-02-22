import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  trend?: string;
  iconColor: string;
  delay?: number;
}

export function KPICard({ icon: Icon, value, label, trend, iconColor, delay = 0 }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.02, translateY: -4 }}
      className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 ${iconColor} rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </motion.div>
  );
}
