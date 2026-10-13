import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Copy, FileText, Linkedin, Loader2, Send, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, Skeleton } from '../components/PageSkeleton';
import { notifyError } from '../lib/errors';
import { generatePost, useContent, useContentSuggestions, useCreatePost, useDeletePost, useUpdatePost } from '../lib/queries';
import type { ContentPost } from '../lib/types';
import { SIGNAL_STYLE } from '../lib/utils';
import { ErrorState } from '../components/ErrorState';

const card = 'bg-white rounded-2xl shadow-sm border border-slate-200';
const shareUrl = (text: string) => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;

function Composer({ initial, onClose }: { initial: { content: string; source_headline: string }; onClose: () => void }) {
  const create = useCreatePost();
  const [content, setContent] = useState(initial.content);
  const [when, setWhen] = useState('');
  const save = (status: ContentPost['status']) =>
    create.mutate(
      { content, status, scheduled_date: status === 'scheduled' && when ? new Date(when).toISOString() : null, source_headline: initial.source_headline },
      {
        onSuccess: () => {
          toast.success(status === 'published' ? 'Marked as published' : status === 'scheduled' ? 'Scheduled' : 'Saved as draft');
          if (status === 'published') window.open(shareUrl(content), '_blank', 'noopener');
          onClose();
        },
      },
    );

  return (
    <div className={`${card} p-5 space-y-3`}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">New post</h3>
        <button onClick={onClose} className="text-sm text-slate-500">Close</button>
      </div>
      {initial.source_headline && <p className="text-xs text-slate-500">Based on: {initial.source_headline}</p>}
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="w-full text-sm px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => save('draft')} disabled={!content.trim() || create.isPending} className="px-4 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200">Save draft</button>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="text-sm px-2 py-2 border border-slate-200 rounded-lg" />
        <button onClick={() => save('scheduled')} disabled={!content.trim() || !when || create.isPending} className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm disabled:opacity-50">Schedule</button>
        <button onClick={() => save('published')} disabled={!content.trim() || create.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm inline-flex items-center gap-2 ml-auto">
          <Linkedin className="w-4 h-4" /> Post to LinkedIn
        </button>
      </div>
    </div>
  );
}

function PostRow({ post }: { post: ContentPost }) {
  const update = useUpdatePost();
  const del = useDeletePost();
  const badge = { draft: 'bg-slate-200 text-slate-700', scheduled: 'bg-orange-100 text-orange-700', published: 'bg-green-100 text-green-700' }[post.status];
  const when =
    post.status === 'published' && post.published_date ? `Published ${format(new Date(post.published_date), 'MMM d, yyyy')}`
      : post.status === 'scheduled' && post.scheduled_date ? `Scheduled for ${format(new Date(post.scheduled_date), 'MMM d, yyyy · h:mm a')}`
        : `Created ${format(new Date(post.created_at), 'MMM d')}`;
  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm text-slate-700 whitespace-pre-wrap flex-1">{post.content}</p>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${badge}`}>{post.status}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 text-xs">
        <span className="text-slate-500 flex-1">{when}</span>
        <button onClick={() => navigator.clipboard.writeText(post.content).then(() => toast.success('Copied'))} className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-200"><Copy className="w-3.5 h-3.5" /> Copy</button>
        {post.status !== 'published' && (
          <button
            onClick={() => { window.open(shareUrl(post.content), '_blank', 'noopener'); update.mutate({ id: post.id, status: 'published' }); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-600 text-white"
          >
            <Send className="w-3.5 h-3.5" /> Publish
          </button>
        )}
        <button onClick={() => del.mutate(post.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-600 hover:bg-red-50" aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

export function ContentEngine() {
  const { data: posts = [], isLoading, isError, error, refetch, isFetching } = useContent();
  const sugg = useContentSuggestions();
  const { data: suggestions = [], isLoading: sLoading } = sugg;
  const [draft, setDraft] = useState<{ content: string; source_headline: string } | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const generate = async (headline = '') => {
    setGenerating(headline || '__new__');
    try {
      setDraft(await generatePost({ headline }));
    } catch (e) {
      notifyError(e, { title: "Couldn't generate a post", onRetry: () => generate(headline) });
    } finally {
      setGenerating(null);
    }
  };

  const groups: { title: string; status: ContentPost['status'] }[] = [
    { title: 'Scheduled', status: 'scheduled' },
    { title: 'Drafts', status: 'draft' },
    { title: 'Published', status: 'published' },
  ];
  const count = (s: ContentPost['status']) => posts.filter((p) => p.status === s).length;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-1">Content Engine</h1>
          <p className="text-slate-600">LinkedIn posts written by AI from today's industry news.</p>
        </div>
        <button onClick={() => generate()} disabled={!!generating} className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2 shadow-sm disabled:opacity-60">
          {generating === '__new__' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} Generate post
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Drafts', n: count('draft'), icon: FileText, tone: 'text-blue-600' },
          { label: 'Scheduled', n: count('scheduled'), icon: Calendar, tone: 'text-orange-600' },
          { label: 'Published', n: count('published'), icon: TrendingUp, tone: 'text-green-600' },
        ].map(({ label, n, icon: Icon, tone }) => (
          <div key={label} className={`${card} p-5`}>
            <div className="flex items-center justify-between mb-2"><Icon className={`w-7 h-7 ${tone}`} /><span className="text-2xl font-bold text-slate-900">{n}</span></div>
            <div className="text-sm text-slate-600">{label}</div>
          </div>
        ))}
      </div>

      {draft && <Composer key={draft.content} initial={draft} onClose={() => setDraft(null)} />}

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" /> Ideas from today's news</h2>
        {sugg.isError && !suggestions.length ? (
          <ErrorState compact error={sugg.error} title="Couldn't load news ideas" onRetry={() => sugg.refetch()} retrying={sugg.isFetching} />
        ) : sLoading && !suggestions.length ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
        ) : suggestions.length === 0 ? (
          <EmptyState icon={Sparkles} title="No relevant headlines right now">Use "Generate post" for a general industry post.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestions.map((s) => {
              const style = SIGNAL_STYLE[s.signal as keyof typeof SIGNAL_STYLE] ?? SIGNAL_STYLE.neutral;
              return (
                <div key={s.topic} className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border border-blue-100 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-semibold uppercase ${style.text}`}>{style.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.engagement === 'High' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{s.engagement}</span>
                  </div>
                  <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-slate-900 text-sm mb-1 line-clamp-3 hover:text-blue-600">{s.topic}</a>
                  <p className="text-xs text-slate-600 mb-4 flex-1">{s.angle}</p>
                  <button onClick={() => generate(s.topic)} disabled={!!generating} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
                    {generating === s.topic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Write post
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={`${card} p-5 space-y-5`}>
        <h2 className="text-xl font-bold text-slate-900">Your content</h2>
        {isError && !posts.length ? (
          <ErrorState compact error={error} title="Couldn't load your posts" onRetry={() => refetch()} retrying={isFetching} />
        ) : isLoading && !posts.length ? (
          <Skeleton className="h-24" />
        ) : posts.length === 0 ? (
          <p className="text-sm text-slate-500">No posts yet. Generate one from a headline above.</p>
        ) : (
          groups.map(({ title, status }) => {
            const list = posts.filter((p) => p.status === status);
            return list.length ? (
              <div key={status} className="space-y-3">
                <h3 className="font-semibold text-slate-700">{title}</h3>
                {list.map((p) => <PostRow key={p.id} post={p} />)}
              </div>
            ) : null;
          })
        )}
      </section>
    </div>
  );
}
