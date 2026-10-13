import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { format, isAfter } from 'date-fns';
import { Calendar, CheckCircle2, Clock, FileText, Loader2, MessageSquare, Send, Video, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, Skeleton } from '../components/PageSkeleton';
import { useMeetingAction, useMeetings, useUpdateMeeting } from '../lib/queries';
import type { Meeting } from '../lib/types';
import { ErrorState } from '../components/ErrorState';

const card = 'bg-white rounded-2xl shadow-sm p-6 border border-slate-200';

function MeetingCard({ m }: { m: Meeting }) {
  const update = useUpdateMeeting();
  const action = useMeetingAction();
  const [notes, setNotes] = useState(m.notes);
  const date = new Date(m.date);
  const upcoming = m.status === 'scheduled' && isAfter(date, new Date());
  const run = (a: 'summary' | 'follow-up') =>
    action.mutate({ id: m.id, action: a }, {
      onSuccess: () => toast.success(a === 'summary' ? 'Summary generated' : 'Follow-up drafted in the conversation'),
    });

  return (
    <div className={card}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-lg font-bold text-slate-900">{m.title}</h3>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${m.status === 'completed' ? 'bg-green-100 text-green-700' : m.status === 'cancelled' ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'}`}>
              {m.status}
            </span>
          </div>
          <div className="text-sm text-slate-600 space-y-0.5">
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {format(date, 'EEE, MMM d, yyyy')}</div>
            <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> {format(date, 'h:mm a')} · {m.duration} min</div>
            <div className="font-semibold text-slate-900">{m.lead_name !== m.lead_company ? `${m.lead_name} · ` : ''}{m.lead_company}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.meeting_link && upcoming && (
            <a href={m.meeting_link} target="_blank" rel="noreferrer" className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm inline-flex items-center gap-2"><Video className="w-4 h-4" /> Join</a>
          )}
          <Link to="/conversations" state={{ openId: m.conversation_id }} className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-sm inline-flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Chat</Link>
          {m.status === 'scheduled' && (
            <>
              <button onClick={() => update.mutate({ id: m.id, status: 'completed' })} className="px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Done</button>
              <button onClick={() => update.mutate({ id: m.id, status: 'cancelled' })} className="px-3 py-2 text-slate-500 rounded-lg hover:bg-slate-100 text-sm inline-flex items-center gap-1"><XCircle className="w-4 h-4" /> Cancel</button>
            </>
          )}
        </div>
      </div>

      {m.status === 'completed' && (
        <div className="mt-4 space-y-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== m.notes && update.mutate({ id: m.id, notes })}
            rows={3}
            placeholder="Meeting notes: what did they need, volumes, timelines…"
            className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {m.ai_summary && (
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-slate-900"><FileText className="w-4 h-4 text-blue-600" /> AI summary</div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.ai_summary}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => run('summary')} disabled={action.isPending} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm inline-flex items-center gap-2 disabled:opacity-60">
              {action.isPending && action.variables?.action === 'summary' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} {m.ai_summary ? 'Regenerate summary' : 'Generate summary'}
            </button>
            {m.follow_up_sent ? (
              <span className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Follow-up drafted</span>
            ) : (
              <button onClick={() => run('follow-up')} disabled={action.isPending} className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-sm inline-flex items-center gap-2 disabled:opacity-60">
                <Send className="w-4 h-4" /> Draft follow-up
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Meetings() {
  const { data: meetings = [], isLoading, isError, error, refetch, isFetching } = useMeetings();
  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    return {
      upcoming: meetings.filter((m) => m.status === 'scheduled' && isAfter(new Date(m.date), now)),
      past: meetings.filter((m) => !(m.status === 'scheduled' && isAfter(new Date(m.date), now))).reverse(),
    };
  }, [meetings]);
  const completed = meetings.filter((m) => m.status === 'completed').length;
  const held = meetings.filter((m) => m.status !== 'scheduled').length;

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-1">Meetings</h1>
        <p className="text-slate-600">Schedule meetings from a conversation. AI writes summaries and follow-ups.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Upcoming', value: upcoming.length, icon: Calendar, tone: 'bg-blue-100 text-blue-600' },
          { label: 'Completed', value: completed, icon: CheckCircle2, tone: 'bg-green-100 text-green-600' },
          { label: 'Show-up rate', value: held ? `${Math.round((completed / held) * 100)}%` : '—', icon: Video, tone: 'bg-purple-100 text-purple-600' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`${card} flex items-center gap-4`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tone}`}><Icon className="w-6 h-6" /></div>
            <div><div className="text-3xl font-bold text-slate-900">{value}</div><div className="text-sm text-slate-600">{label}</div></div>
          </div>
        ))}
      </div>

      {isError && !meetings.length ? (
        <ErrorState error={error} title="Couldn't load meetings" onRetry={() => refetch()} retrying={isFetching} />
      ) : isLoading && !meetings.length ? (
        <div className="space-y-4">{[0, 1].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : (
        <>
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-600" /> Upcoming</h2>
            {upcoming.length ? (
              <div className="space-y-4">{upcoming.map((m) => <MeetingCard key={m.id} m={m} />)}</div>
            ) : (
              <EmptyState icon={Calendar} title="No upcoming meetings">
                Open a <Link to="/conversations" className="text-blue-600 font-semibold">conversation</Link> and click "Schedule meeting".
              </EmptyState>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-600" /> Past</h2>
              <div className="space-y-4">{past.map((m) => <MeetingCard key={m.id} m={m} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
