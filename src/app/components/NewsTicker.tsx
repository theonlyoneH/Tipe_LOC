import { memo } from 'react';
import { useNews } from '../lib/queries';
import { useSession } from '../lib/session';
import { SIGNAL_STYLE } from '../lib/utils';

export const NewsTicker = memo(function NewsTicker() {
  const industry = useSession((s) => s.user?.industry ?? '');
  const { data: news = [], isLoading } = useNews(industry);

  const items = news.map((a) => {
    const style = SIGNAL_STYLE[a.signal] ?? SIGNAL_STYLE.neutral;
    return (
      <a
        key={a.id}
        href={a.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 hover:text-blue-300 transition-colors"
        title={`${style.label}${a.countries.length ? ` · ${a.countries.join(', ')}` : ''} · ${a.source}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        <span className="text-slate-400 uppercase tracking-wide text-[10px]">{style.label}</span>
        <span>{a.headline}</span>
      </a>
    );
  });

  return (
    <div className="h-8 bg-slate-900 text-white flex items-center overflow-hidden border-b border-slate-700 relative z-50 text-xs font-medium">
      <div className="shrink-0 h-full flex items-center gap-1.5 px-3 bg-blue-600 font-semibold z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
      </div>
      {news.length > 0 ? (
        <div
          className="ticker-track flex whitespace-nowrap"
          style={{ ['--ticker-duration' as any]: `${Math.max(40, news.length * 7)}s` }}
        >
          <div className="flex gap-10 pl-10">{items}</div>
          <div aria-hidden className="flex gap-10 pl-10">{items}</div>
        </div>
      ) : (
        <span className="pl-4 text-slate-400">{isLoading ? 'Loading live trade news…' : 'No trade news available right now'}</span>
      )}
    </div>
  );
});
