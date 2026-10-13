export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: any; title: string; children?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
      <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="text-sm text-slate-500 mt-1">{children}</div>}
    </div>
  );
}
