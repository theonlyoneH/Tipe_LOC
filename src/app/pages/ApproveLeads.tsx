import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CheckCircle, RefreshCw, RotateCcw, SkipForward, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { LeadCardBody, SwipeCard, type SwipeDirection } from '../components/SwipeCard';
import { EngineBadge } from '../components/EngineBadge';
import { SourcingBadge, SourcingPanel } from '../components/SourcingStatus';
import { Skeleton } from '../components/PageSkeleton';
import { isSourcing, keys, useDecision, useLeads, useRejectionFeedback, useUndoDecision } from '../lib/queries';
import { useSession } from '../lib/session';
import type { Decision, Lead } from '../lib/types';
import { CHANNELS, channelOf, flag } from '../lib/utils';
import { ErrorState } from '../components/ErrorState';

// Leaflet is only needed here; load it alongside (not before) the deck.
const DeckMap = lazy(() => import('../components/DeckMap'));

const DECISION: Record<SwipeDirection, Decision> = { right: 'approved', left: 'rejected', up: 'skipped' };

const exitVariants = {
  exit: (dir: SwipeDirection) => ({
    x: dir === 'right' ? 700 : dir === 'left' ? -700 : 0,
    y: dir === 'up' ? -700 : 0,
    rotate: dir === 'right' ? 18 : dir === 'left' ? -18 : 0,
    opacity: 0,
    transition: { duration: 0.3 },
  }),
};

interface PendingReason {
  lead: Lead;
  inferred: string | null;
  chosen: string | null;
}

export function ApproveLeads() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const { data, isLoading, isError, error, refetch, isFetching } = useLeads();
  const decide = useDecision();
  const undo = useUndoDecision();
  const explain = useRejectionFeedback();

  // Session-local state so the deck reacts instantly, before the server re-ranks.
  const [decided, setDecided] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<string[]>([]);
  const [history, setHistory] = useState<{ lead: Lead; decision: Decision }[]>([]);
  const [exitDir, setExitDir] = useState<SwipeDirection>('right');
  const [counts, setCounts] = useState({ approved: 0, rejected: 0 });
  const [pendingReason, setPendingReason] = useState<PendingReason | null>(null);
  const topIdRef = useRef<string | null>(null);
  const rerankTimer = useRef<number>();
  const reasonTimer = useRef<number>();

  const queue = useMemo(() => {
    const leads = (data?.leads ?? []).filter((l) => !decided.has(l.id));
    const skippedSet = new Set(skipped);
    const fresh = leads.filter((l) => !skippedSet.has(l.id));
    const later = skipped.map((id) => leads.find((l) => l.id === id)).filter(Boolean) as Lead[];
    const ordered = [...fresh, ...later];
    // Keep the card the user is looking at stable when a re-rank arrives.
    const pinned = topIdRef.current ? ordered.findIndex((l) => l.id === topIdRef.current) : -1;
    if (pinned > 0) ordered.unshift(...ordered.splice(pinned, 1));
    return ordered;
  }, [data, decided, skipped]);

  const current = queue[0];
  const next = queue[1];
  useEffect(() => {
    topIdRef.current = current?.id ?? null;
  }, [current?.id]);

  // Re-rank with the new swipe feedback, debounced so rapid swiping stays smooth.
  const scheduleRerank = useCallback(
    (delay = 1200) => {
      window.clearTimeout(rerankTimer.current);
      rerankTimer.current = window.setTimeout(() => qc.invalidateQueries({ queryKey: keys.leads }), delay);
    },
    [qc],
  );
  useEffect(() => () => {
    window.clearTimeout(rerankTimer.current);
    window.clearTimeout(reasonTimer.current);
  }, []);

  const showReasonPicker = useCallback((p: PendingReason) => {
    setPendingReason(p);
    window.clearTimeout(reasonTimer.current);
    reasonTimer.current = window.setTimeout(() => setPendingReason(null), 9000);
  }, []);

  const giveReason = useCallback(
    (reason: string) => {
      if (!pendingReason) return;
      const { lead } = pendingReason;
      setPendingReason({ ...pendingReason, chosen: reason });
      window.clearTimeout(reasonTimer.current);
      reasonTimer.current = window.setTimeout(() => setPendingReason(null), 900);
      explain.mutate(
        { leadId: lead.id, reason },
        {
          onSuccess: () => toast.success('Got it - re-ranking with that in mind', { duration: 1800 }),
        },
      );
    },
    [pendingReason, explain],
  );

  const handleSwipe = useCallback(
    (direction: SwipeDirection) => {
      if (!current) return;
      const lead = current;
      const decision = DECISION[direction];
      setExitDir(direction);
      topIdRef.current = null;

      if (decision === 'skipped') {
        setSkipped((s) => [...s.filter((id) => id !== lead.id), lead.id]);
      } else {
        setDecided((s) => new Set(s).add(lead.id));
        setCounts((c) => ({ ...c, [decision]: c[decision as 'approved' | 'rejected'] + 1 }));
      }
      setHistory((h) => [...h.slice(-19), { lead, decision }]);
      if (decision === 'rejected') showReasonPicker({ lead, inferred: null, chosen: null });
      else setPendingReason(null);

      decide.mutate(
        { lead, decision },
        {
          onSuccess: (res) => {
            if (decision === 'approved') {
              const ch = CHANNELS[channelOf(lead.preferred_channel)].label;
              toast.success(`${lead.company_name} approved`, {
                description: `AI is drafting a ${ch} opener using today's news.`,
                action: res.conversation_id
                  ? { label: 'Open chat', onClick: () => navigate('/conversations', { state: { openId: res.conversation_id } }) }
                  : undefined,
              });
            }
            if (decision === 'rejected' && res.inferred_reason) {
              setPendingReason((p) => (p && p.lead.id === lead.id ? { ...p, inferred: res.inferred_reason } : p));
            }
            scheduleRerank();
          },
          onError: () => {
            // Put the card back so the user can swipe again.
            setDecided((s) => {
              const n = new Set(s);
              n.delete(lead.id);
              return n;
            });
          },
        },
      );
    },
    [current, decide, navigate, scheduleRerank, showReasonPicker],
  );

  const handleUndo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setPendingReason(null);
    setDecided((s) => {
      const n = new Set(s);
      n.delete(last.lead.id);
      return n;
    });
    setSkipped((s) => s.filter((id) => id !== last.lead.id));
    if (last.decision !== 'skipped') setCounts((c) => ({ ...c, [last.decision]: Math.max(0, c[last.decision as 'approved' | 'rejected'] - 1) }));
    topIdRef.current = last.lead.id;
    undo.mutate(last.lead.id, {
      onSuccess: () => toast.info(`Restored ${last.lead.company_name}`),
    });
  }, [history, undo]);

  const reasons = data?.reject_reasons ?? [];

  // Keyboard: ← reject, → approve, ↑ skip, Z / Backspace undo, 1-5 rejection reason.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const n = Number(e.key);
      if (pendingReason && !pendingReason.chosen && n >= 1 && n <= reasons.length) giveReason(reasons[n - 1].key);
      else if (e.key === 'ArrowRight') handleSwipe('right');
      else if (e.key === 'ArrowLeft') handleSwipe('left');
      else if (e.key === 'ArrowUp') handleSwipe('up');
      else if (e.key === 'z' || e.key === 'Backspace') handleUndo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSwipe, handleUndo, giveReason, pendingReason, reasons]);

  if (isLoading && !data) {
    return (
      <div className="h-full p-4 lg:p-8 flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="flex-1 min-h-[420px] rounded-[32px] lg:w-[560px] lg:ml-auto" />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <ErrorState error={error} title="Couldn't load your leads" onRetry={() => refetch()} retrying={isFetching} />
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden bg-slate-100">
      <Suspense fallback={null}>
        <DeckMap leads={queue} current={current} homeCountry={user?.country} hotCountries={data?.engine?.regime.hot_countries} />
      </Suspense>
      {/* Fade the map under the deck so cards stay readable. */}
      <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-t from-slate-50 via-slate-50/60 to-transparent lg:bg-gradient-to-l lg:from-slate-50/95 lg:via-slate-50/40 lg:to-transparent" />

      <div className="relative z-10 h-full flex flex-col p-4 lg:p-6 pointer-events-none">
        {/* Header */}
        <div className="pointer-events-auto flex flex-wrap items-start justify-between gap-3">
          <div className="bg-white/85 backdrop-blur rounded-2xl px-4 py-3 shadow-sm border border-white">
            <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-600" /> Approve Leads
            </h1>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs lg:text-sm mt-0.5 text-slate-600">
              <span>{queue.length} in deck</span>
              <span className="text-green-600">✓ {counts.approved}</span>
              <span className="text-red-600">✗ {counts.rejected}</span>
              {current && <span className="font-medium text-slate-800">{flag(current.country)} Now: {current.country || 'Unknown'}</span>}
            </div>
            <div className="mt-1"><SourcingBadge sourcing={data?.sourcing} /></div>
          </div>
          <div className="flex items-start gap-2">
            {data?.engine && <EngineBadge engine={data.engine} />}
            <button
              onClick={() => refetch()}
              className="text-xs font-semibold inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/90 backdrop-blur border border-slate-200 shadow-sm hover:bg-white"
              title="Re-rank with the latest news"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Re-rank</span>
            </button>
          </div>
        </div>

        {/* Deck: right column on desktop (map visible on the left), lower part of the screen on mobile */}
        <div className="flex-1 min-h-0 flex flex-col w-full lg:w-[min(580px,52%)] lg:ml-auto mt-[14vh] lg:mt-4">
          {!current && (isSourcing(data) || (data?.sourcing?.mode === 'live' && !data.leads.length && !history.length)) ? (
            <div className="pointer-events-auto flex-1 flex items-center justify-center bg-white/90 backdrop-blur rounded-[32px] p-8">
              <SourcingPanel sourcing={data?.sourcing} industry={user?.industry} />
            </div>
          ) : !current ? (
            <div className="pointer-events-auto flex-1 flex items-center justify-center text-center bg-white/90 backdrop-blur rounded-[32px] p-8">
              <div>
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold">All caught up!</h2>
                <p className="text-slate-600 mb-4">No more leads to review for your industry right now.</p>
                <div className="flex gap-2 justify-center">
                  {history.length > 0 && (
                    <button onClick={handleUndo} className="px-4 py-2 rounded-lg bg-white border border-slate-200 inline-flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Undo last</button>
                  )}
                  <button onClick={() => navigate('/conversations')} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Go to outreach</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="pointer-events-auto flex-1 relative min-h-[380px]">
                {next && (
                  <div className="absolute inset-0 scale-[0.96] translate-y-3 opacity-70 pointer-events-none" aria-hidden>
                    <LeadCardBody lead={next} isTop={false} />
                  </div>
                )}
                <AnimatePresence custom={exitDir} initial={false}>
                  <motion.div
                    key={current.id}
                    className="absolute inset-0"
                    custom={exitDir}
                    variants={exitVariants}
                    initial={{ scale: 0.96, y: 12, opacity: 0.7 }}
                    animate={{ scale: 1, y: 0, opacity: 1, transition: { duration: 0.2 } }}
                    exit="exit"
                  >
                    <SwipeCard lead={current} onSwipe={handleSwipe} />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Why was it rejected? */}
              <AnimatePresence>
                {pendingReason && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="pointer-events-auto mt-3 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-lg p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                      <span className="font-semibold text-slate-800">Why not {pendingReason.lead.company_name}?</span>
                      <button onClick={() => setPendingReason(null)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {reasons.map((r, i) => {
                        const chosen = pendingReason.chosen === r.key;
                        const guessed = !pendingReason.chosen && pendingReason.inferred === r.key;
                        return (
                          <button
                            key={r.key}
                            onClick={() => giveReason(r.key)}
                            disabled={!!pendingReason.chosen}
                            className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                              chosen ? 'bg-red-600 border-red-600 text-white'
                                : guessed ? 'border-red-300 bg-red-50 text-red-700'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="hidden lg:inline text-slate-400 mr-1">{i + 1}</span>
                            {r.label}
                            {guessed && <span className="ml-1 text-[10px] uppercase">· our guess</span>}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="pointer-events-auto flex items-center justify-center gap-4 pt-4">
                <button onClick={handleUndo} disabled={!history.length} className="w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 disabled:opacity-40" aria-label="Undo (Z)" title="Undo (Z)">
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button onClick={() => handleSwipe('left')} className="w-14 h-14 rounded-full bg-white border-2 border-red-200 shadow-md flex items-center justify-center text-red-500 hover:bg-red-50" aria-label="Reject (←)" title="Reject (←)">
                  <X className="w-7 h-7" />
                </button>
                <button onClick={() => handleSwipe('up')} className="w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:bg-slate-50" aria-label="Skip (↑)" title="Skip (↑)">
                  <SkipForward className="w-5 h-5" />
                </button>
                <button onClick={() => handleSwipe('right')} className="w-14 h-14 rounded-full bg-green-500 shadow-md flex items-center justify-center text-white hover:bg-green-600" aria-label="Approve and start outreach (→)" title="Approve & start outreach (→)">
                  <Check className="w-7 h-7" />
                </button>
              </div>
              <p className="hidden lg:block text-center text-xs text-slate-500 mt-2">← reject · → approve and start outreach · ↑ skip · Z undo · 1-5 rejection reason</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
