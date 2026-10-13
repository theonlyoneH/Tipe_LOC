import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Bot, Calendar, Check, Copy, ExternalLink, Inbox, Loader2, MessageCircle, Pencil, RefreshCw, Send, Sparkles, Trash2, User as UserIcon, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { notifyError } from '../lib/errors';
import {
  suggestReply,
  useApproveDraft,
  useConversation,
  useConversations,
  useCreateMeeting,
  useDiscardDraft,
  useFollowUp,
  useSendMessage,
  useUpdateConversation,
} from '../lib/queries';
import type { Channel, Conversation, Message } from '../lib/types';
import { CHANNELS, STAGE_LABEL, channelLink, conversationSlugs, flag, timeAgo } from '../lib/utils';
import { Skeleton } from '../components/PageSkeleton';
import { ErrorState } from '../components/ErrorState';

// ---------------------------------------------------------------------------
// Conversation list
// ---------------------------------------------------------------------------

function ConversationList({ conversations, selectedId, slugOf, loading, error, onRetry }: { conversations: Conversation[]; selectedId?: string; slugOf: (id: string) => string; loading: boolean; error?: unknown; onRetry?: () => void }) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'ai'>('all');
  const shown = conversations.filter((c) => (filter === 'unread' ? c.unread > 0 : filter === 'ai' ? c.ai_handling : true));
  return (
    <div className={`w-full md:w-80 bg-white border-r border-slate-200 flex flex-col min-h-0 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
      <div className="p-5 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900">Outreach</h2>
        <p className="text-sm text-slate-600 mt-0.5">{conversations.length} conversations</p>
        <div className="flex gap-1 mt-3">
          {(['all', 'unread', 'ai'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-full font-medium ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {f === 'ai' ? 'AI handling' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {error && !conversations.length ? (
          <div className="p-4"><ErrorState compact error={error} title="Couldn't load conversations" onRetry={onRetry} /></div>
        ) : loading && !conversations.length ? (
          <div className="p-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : shown.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {conversations.length ? 'Nothing here.' : <>Approve a lead to start outreach.<br /><Link to="/approve" className="text-blue-600 font-semibold">Review leads →</Link></>}
          </div>
        ) : (
          shown.map((c) => {
            const ch = CHANNELS[c.channel];
            return (
              <Link
                key={c.id}
                to={`/conversations/${slugOf(c.id)}`}
                className={`block p-4 border-b border-slate-100 transition-colors ${selectedId === c.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{flag(c.country)} {c.lead_company}</div>
                    <div className="text-xs text-slate-500">{STAGE_LABEL[c.stage] ?? c.stage}{c.ai_handling ? ' · AI' : ''}</div>
                  </div>
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ch.badge}`}><ch.icon className="w-3.5 h-3.5" /></span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-1">{c.last_message}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-400">{timeAgo(c.updated_at)}</span>
                  {c.unread > 0 && <span className="min-w-5 h-5 px-1.5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">{c.unread}</span>}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<Message['status'], string> = {
  draft: 'Draft · needs your approval',
  approved: 'Approved · ready to send',
  delivered: 'Sent',
  received: 'Received',
};

function MessageBubble({ m, conv }: { m: Message; conv: Conversation }) {
  const approve = useApproveDraft(conv.id);
  const discard = useDiscardDraft(conv.id);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.content);
  const fromLead = m.sender === 'lead';
  const action = !fromLead && m.status !== 'draft' ? channelLink(conv.channel, conv.contact ?? {}, m.content) : null;
  const copy = () =>
    navigator.clipboard
      .writeText(m.content)
      .then(() => toast.success('Message copied - paste it into ' + CHANNELS[conv.channel].label))
      .catch(() => toast.error("Couldn't access the clipboard. Select the text and copy it manually."));

  return (
    <div className={`flex ${fromLead ? 'justify-start' : 'justify-end'}`}>
      <div className="max-w-[85%] lg:max-w-xl">
        <div
          className={`rounded-2xl px-4 py-3 ${
            fromLead
              ? 'bg-white border border-slate-200 text-slate-900'
              : m.status === 'draft'
                ? 'bg-amber-50 border-2 border-dashed border-amber-300 text-slate-900'
                : m.sender === 'ai'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
                  : 'bg-blue-600 text-white'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1 text-xs opacity-80">
            {fromLead ? <UserIcon className="w-3 h-3" /> : m.sender === 'ai' ? <Bot className="w-3 h-3" /> : <Send className="w-3 h-3" />}
            <span>{fromLead ? conv.lead_company : m.sender === 'ai' ? 'TIPE AI' : 'You'}</span>
          </div>
          {editing ? (
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(12, text.split('\n').length + 2)} className="w-full text-sm bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
          )}
          {m.status === 'draft' && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => approve.mutate({ id: m.id, content: editing ? text : undefined }, { onSuccess: () => setEditing(false) })}
                disabled={approve.isPending}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
              >
                {approve.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve{editing ? ' edit' : ''}
              </button>
              <button onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700">
                <Pencil className="w-3.5 h-3.5" /> {editing ? 'Cancel' : 'Edit'}
              </button>
              <button onClick={() => discard.mutate(m.id)} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" /> Discard
              </button>
            </div>
          )}
        </div>
        <div className={`flex items-center gap-2 text-[11px] text-slate-500 mt-1 px-2 ${fromLead ? '' : 'justify-end'}`}>
          <span>{timeAgo(m.created_at)}</span>
          {!fromLead && <span>· {STATUS_LABEL[m.status]}</span>}
        </div>
        {/* Send it yourself: always visible on our messages. */}
        {!fromLead && (
          <div className="flex flex-wrap items-center justify-end gap-2 mt-1.5 px-1">
            <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50">
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            {action && (
              <a href={action.href} target="_blank" rel="noreferrer" title={action.hint}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700">
                <ExternalLink className="w-3.5 h-3.5" /> {action.label}
              </a>
            )}
            {m.status === 'draft' && <span className="text-[11px] text-amber-700">Approve the draft to open it in {CHANNELS[conv.channel].label}</span>}
            {action?.hint && <span className="w-full text-right text-[11px] text-slate-400">{action.hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meeting scheduler
// ---------------------------------------------------------------------------

function ScheduleMeeting({ conv, onDone }: { conv: Conversation; onDone: () => void }) {
  const create = useCreateMeeting();
  const tomorrow = new Date(Date.now() + 24 * 3600_000);
  tomorrow.setMinutes(0, 0, 0);
  const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const [form, setForm] = useState({ title: `Intro call with ${conv.lead_company}`, date: local, duration: 30, meeting_link: '' });

  return (
    <form
      className="space-y-2 bg-white border border-slate-200 rounded-xl p-3"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(
          { conversation_id: conv.id, ...form, date: new Date(form.date).toISOString() },
          { onSuccess: () => { toast.success('Meeting scheduled'); onDone(); } },
        );
      }}
    >
      <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg" placeholder="Title" />
      <div className="flex gap-2">
        <input required type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="flex-1 min-w-0 text-sm px-2 py-2 border border-slate-200 rounded-lg" />
        <select value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} className="text-sm px-2 py-2 border border-slate-200 rounded-lg">
          {[15, 30, 45, 60].map((d) => <option key={d} value={d}>{d}m</option>)}
        </select>
      </div>
      <input type="url" value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg" placeholder="Meeting link (optional)" />
      <div className="flex gap-2">
        <button type="submit" disabled={create.isPending} className="flex-1 text-sm py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60">{create.isPending ? 'Saving…' : 'Schedule'}</button>
        <button type="button" onClick={onDone} className="text-sm px-3 py-2 bg-slate-100 rounded-lg">Cancel</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// AI side panel
// ---------------------------------------------------------------------------

function InsightPanel({ conv, canDeliver, mobileOpen, onClose }: { conv: Conversation; canDeliver: boolean; mobileOpen: boolean; onClose: () => void }) {
  const followUp = useFollowUp(conv.id);
  const update = useUpdateConversation(conv.id);
  const [scheduling, setScheduling] = useState(false);
  const [email, setEmail] = useState(conv.contact?.email ?? '');
  const a = conv.analysis;
  const sentiment = Math.round((a?.sentiment ?? 0.5) * 100);

  useEffect(() => setEmail(conv.contact?.email ?? ''), [conv.id, conv.contact?.email]);

  return (
    <aside className={`${mobileOpen ? 'fixed inset-y-0 right-0 z-40 flex shadow-2xl' : 'hidden'} xl:static xl:flex xl:shadow-none w-80 max-w-full bg-white border-l border-slate-200 p-5 flex-col gap-4 overflow-y-auto`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Sparkles className="w-5 h-5 text-blue-600" /> AI insights</h3>
        <button onClick={onClose} className="xl:hidden text-sm text-slate-500" aria-label="Close insights">Close</button>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
        <div className="text-xs font-semibold text-slate-600 mb-1">Stage</div>
        <div className="text-xl font-bold text-blue-700">{STAGE_LABEL[conv.stage] ?? conv.stage}</div>
        {a?.summary && <p className="text-xs text-slate-600 mt-2">{a.summary}</p>}
      </div>

      <div className="bg-slate-50 rounded-xl p-4">
        <div className="flex justify-between text-sm font-semibold text-slate-900 mb-2">
          <span>Sentiment</span>
          <span className={sentiment > 60 ? 'text-green-600' : sentiment < 40 ? 'text-red-600' : 'text-slate-600'}>{a?.sentiment_label ?? 'Awaiting reply'}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${sentiment > 60 ? 'bg-green-500' : sentiment < 40 ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${sentiment}%` }} />
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl p-4">
        <div className="text-sm font-semibold text-slate-900 mb-1">Next best action</div>
        <p className="text-sm text-slate-600">{a?.next_action ?? 'Waiting for the prospect to reply. Send a follow-up in a few days.'}</p>
        <div className="flex flex-col gap-2 mt-3">
          <button onClick={() => followUp.mutate(undefined)} disabled={followUp.isPending} className="text-sm py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {followUp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Draft follow-up
          </button>
          {scheduling ? (
            <ScheduleMeeting conv={conv} onDone={() => setScheduling(false)} />
          ) : (
            <button onClick={() => setScheduling(true)} className={`text-sm py-2 rounded-lg inline-flex items-center justify-center gap-2 ${a?.meeting_intent ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 hover:bg-slate-100'}`}>
              <Calendar className="w-4 h-4" /> Schedule meeting{a?.meeting_intent ? ' (requested)' : ''}
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl p-4 space-y-2">
        <div className="text-sm font-semibold text-slate-900">Delivery</div>
        <p className="text-xs text-slate-600">
          {canDeliver
            ? 'Approved email messages are sent automatically via SMTP.'
            : `Approved messages are queued as "ready to send". Copy them or open ${CHANNELS[conv.channel].label} to send.`}
        </p>
        {conv.channel === 'email' && (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); update.mutate({ contact_email: email }, { onSuccess: () => toast.success('Contact saved') }); }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Prospect email" className="flex-1 min-w-0 text-sm px-3 py-1.5 border border-slate-200 rounded-lg" />
            <button className="text-xs px-3 rounded-lg bg-slate-900 text-white">Save</button>
          </form>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Thread
// ---------------------------------------------------------------------------

function Thread({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch, isFetching } = useConversation(id);
  const send = useSendMessage(id);
  const update = useUpdateConversation(id);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'user' | 'lead'>('user');
  const [suggesting, setSuggesting] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const conv = data?.conversation;
  const messages = data?.messages ?? [];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, id, send.isPending]);

  if (isLoading && !data) return <div className="flex-1 p-6 space-y-4"><Skeleton className="h-16" /><Skeleton className="h-24 w-2/3" /><Skeleton className="h-24 w-2/3 ml-auto" /></div>;
  if (isError || !conv)
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <ErrorState error={error} title="Couldn't open this conversation" onRetry={() => refetch()} retrying={isFetching} />
      </div>
    );

  const submit = () => {
    const content = input.trim();
    if (!content) return;
    send.mutate(
      { content, sender: mode },
      {
        onSuccess: () => {
          setInput('');
          if (mode === 'lead') setMode('user');
        },
      },
    );
  };

  const suggest = async () => {
    setSuggesting(true);
    try {
      const res = await suggestReply(id, input);
      setInput(res.content);
      setMode('user');
    } catch (e) {
      notifyError(e, { title: "Couldn't get an AI suggestion", onRetry: suggest });
    } finally {
      setSuggesting(false);
    }
  };

  const ch = CHANNELS[conv.channel];

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-50">
        <div className="bg-white border-b border-slate-200 p-4 flex flex-wrap items-center gap-3">
          <button onClick={() => navigate('/conversations')} className="md:hidden p-1" aria-label="Back"><ArrowLeft className="w-5 h-5" /></button>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-slate-900 truncate">{flag(conv.country)} {conv.lead_company}</h3>
            <p className="text-xs text-slate-500">{conv.lead_name !== conv.lead_company ? `${conv.lead_name} · ` : ''}{conv.country}{conv.match_percentage ? ` · ${conv.match_percentage}% match` : ''}</p>
          </div>
          <select
            value={conv.channel}
            onChange={(e) => update.mutate({ channel: e.target.value as Channel })}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg border-0 ${ch.badge}`}
            aria-label="Channel"
          >
            {(Object.keys(CHANNELS) as Channel[]).map((c) => <option key={c} value={c}>{CHANNELS[c].label}</option>)}
          </select>
          <button
            onClick={() => update.mutate({ ai_handling: !conv.ai_handling })}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${conv.ai_handling ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
          >
            <Bot className="w-4 h-4" /> {conv.ai_handling ? 'AI autopilot on' : 'AI autopilot off'}
          </button>
          <button onClick={() => setInsightsOpen(true)} className="xl:hidden px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Insights
          </button>
        </div>

        <div className={`px-4 py-2 text-xs border-b ${conv.ai_handling ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          {conv.ai_handling
            ? 'Autopilot: when you log a prospect reply, TIPE AI answers right away and approves its own messages.'
            : 'Review mode: TIPE AI drafts messages but holds them for your approval.'}
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
          {messages.map((m) => <MessageBubble key={m.id} m={m} conv={conv} />)}
          {(conv.stage === 'drafting' || (send.isPending && mode === 'lead' && conv.ai_handling)) && (
            <div className="flex justify-end">
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> TIPE AI is writing…
              </div>
            </div>
          )}
          {conv.stage === 'draft_failed' && <p className="text-center text-sm text-red-600">The AI couldn't draft the opener. Write one below or use Suggest.</p>}
        </div>

        <div className="bg-white border-t border-slate-200 p-3 lg:p-4">
          <div className="flex gap-1 mb-2 text-xs">
            <button onClick={() => setMode('user')} className={`px-3 py-1 rounded-full ${mode === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Send as you</button>
            <button onClick={() => setMode('lead')} className={`px-3 py-1 rounded-full inline-flex items-center gap-1 ${mode === 'lead' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`} title="Paste a reply you received in email/LinkedIn/WhatsApp">
              <Inbox className="w-3 h-3" /> Log prospect reply
            </button>
          </div>
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={Math.min(6, Math.max(1, input.split('\n').length))}
              placeholder={mode === 'lead' ? `Paste ${conv.lead_company}'s reply…` : 'Write a message, or describe what to say and click Suggest'}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
            />
            <button onClick={suggest} disabled={suggesting} className="px-3 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 inline-flex items-center gap-1.5 text-sm disabled:opacity-60" title="AI suggests a reply (uses your text as instructions)">
              {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}<span className="hidden sm:inline">Suggest</span>
            </button>
            <button onClick={submit} disabled={send.isPending || !input.trim()} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 inline-flex items-center gap-1.5 text-sm disabled:opacity-60">
              {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}<span className="hidden sm:inline">{mode === 'lead' ? 'Log' : 'Send'}</span>
            </button>
          </div>
        </div>
      </div>
      {insightsOpen && <div className="fixed inset-0 bg-slate-900/40 z-30 xl:hidden" onClick={() => setInsightsOpen(false)} />}
      <InsightPanel conv={conv} canDeliver={!!data?.can_deliver} mobileOpen={insightsOpen} onClose={() => setInsightsOpen(false)} />
    </>
  );
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export function Conversations() {
  const { slug } = useParams();
  const location = useLocation();
  const { data: conversations = [], isLoading, isError, error, refetch } = useConversations();
  const navigate = useNavigate();
  const sorted = useMemo(() => conversations.filter((c) => c.status !== 'archived'), [conversations]);
  const slugs = useMemo(() => conversationSlugs(conversations), [conversations]);
  const slugOf = (id: string) => slugs.byId.get(id) ?? id;
  const openId = (location.state as { openId?: string } | null)?.openId;
  // URLs carry a readable slug, never the database ID.
  const id = slug ? slugs.bySlug.get(slug) ?? (OBJECT_ID.test(slug) ? slug : undefined) : undefined;

  useEffect(() => {
    if (!conversations.length) return;
    // Links from other pages pass the ID invisibly in router state; old /conversations/<id> links still work.
    const target = openId ?? (slug && OBJECT_ID.test(slug) ? slug : undefined);
    if (target && slugs.byId.has(target)) {
      navigate(`/conversations/${slugs.byId.get(target)}`, { replace: true, state: null });
      return;
    }
    // On desktop, open the most recent conversation by default.
    if (!slug && sorted.length && window.matchMedia('(min-width: 768px)').matches) {
      navigate(`/conversations/${slugOf(sorted[0].id)}`, { replace: true });
    }
  }, [slug, openId, conversations.length, sorted, slugs, navigate]);

  const unknownSlug = !!slug && !id && !isLoading && conversations.length > 0;

  return (
    <div className="h-full flex min-h-0">
      <ConversationList conversations={sorted} selectedId={id} slugOf={slugOf} loading={isLoading} error={isError ? error : undefined} onRetry={() => refetch()} />
      {unknownSlug ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-slate-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-semibold text-slate-700">Conversation not found</p>
            <Link to="/conversations" className="text-sm text-blue-600 font-semibold">Back to outreach</Link>
          </div>
        </div>
      ) : id ? (
        <Thread key={id} id={id} />
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-center text-slate-400">
          <div>
            <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Select a conversation</p>
          </div>
        </div>
      )}
    </div>
  );
}
