import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  trend?: string;
  iconColor: string;
  to?: string;
}

export function KPICard({ icon: Icon, value, label, trend, iconColor, to }: KPICardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 ${iconColor} rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">{trend}</span>}
      </div>
      <div className="text-3xl font-bold text-slate-900 mb-1 tabular-nums">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </>
  );
  const cls = 'block bg-white rounded-2xl shadow-sm p-6 border border-slate-200 transition-all hover:shadow-md hover:-translate-y-0.5';
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}
