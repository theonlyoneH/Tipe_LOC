import {
  MutationCache,
  QueryCache,
  QueryClient,
  dehydrate,
  hydrate,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ApiError, api } from './api';
import { notifyError } from './errors';
import { useSession } from './session';
import type {
  Analytics,
  ApprovedLead,
  ContentPost,
  ContentSuggestion,
  Conversation,
  ConversationDetail,
  Decision,
  Lead,
  LeadsResponse,
  Meeting,
  Message,
  NewsArticle,
  User,
} from './types';

// ---------------------------------------------------------------------------
// Query client + localStorage persistence (instant paint from last session)
// ---------------------------------------------------------------------------

declare module '@tanstack/react-query' {
  interface Register {
    // errorTitle: toast title when the mutation fails; silent: caller handles the error itself.
    mutationMeta: { errorTitle?: string; silent?: boolean };
    queryMeta: { silent?: boolean };
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // First-load failures are shown inline by each page (ErrorState). Here we only
    // tell the user when a *background refresh* fails and they're seeing saved data.
    onError: (error, query) => {
      if (query.meta?.silent || query.state.data === undefined) return;
      if (error instanceof ApiError && error.code === 'SESSION_EXPIRED') return notifyError(error);
      notifyError(error, { title: "Couldn't refresh - showing saved data", onRetry: () => query.fetch() });
    },
  }),
  mutationCache: new MutationCache({
    // Every failed action gets a friendly toast with its error code + reference.
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent) return;
      notifyError(error, { title: mutation.meta?.errorTitle });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnWindowFocus: false,
      // Only retry failures that can succeed later (network, timeouts, 5xx), never 4xx.
      retry: (count, err) => (err instanceof ApiError ? err.retryable : true) && count < 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: { retry: false },
  },
});

const CACHE_KEY = 'tipe-query-cache-v2';
// Only cheap-to-store, read-mostly lists are persisted.
const PERSISTED = new Set(['leads', 'news', 'conversations', 'approved', 'meetings', 'content', 'analytics']);

export function restoreCache(email: string | undefined) {
  if (!email) return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.email === email && Date.now() - saved.at < 24 * 60 * 60_000) hydrate(queryClient, saved.state);
  } catch {
    /* corrupt cache - ignore */
  }
}

let saveTimer: number | undefined;
queryClient.getQueryCache().subscribe(() => {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const email = useSession.getState().user?.email;
    if (!email) return;
    try {
      const state = dehydrate(queryClient, {
        shouldDehydrateQuery: (q) => q.state.status === 'success' && PERSISTED.has(String(q.queryKey[0])),
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify({ email, at: Date.now(), state }));
    } catch {
      /* storage full / private mode */
    }
  }, 1000);
});

export function clearCache() {
  queryClient.clear();
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Keys + fetchers (also used for hover prefetching)
// ---------------------------------------------------------------------------

export const keys = {
  leads: ['leads'] as const,
  news: (industry: string) => ['news', industry] as const,
  approved: ['approved'] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  meetings: ['meetings'] as const,
  content: ['content'] as const,
  suggestions: ['content-suggestions'] as const,
  analytics: ['analytics'] as const,
  profile: ['profile'] as const,
  industries: ['industries'] as const,
};

export const fetchers = {
  leads: () => api<LeadsResponse>('/leads'),
  approved: () => api<ApprovedLead[]>('/approved-leads'),
  conversations: () => api<Conversation[]>('/conversations'),
  meetings: () => api<Meeting[]>('/meetings'),
  content: () => api<ContentPost[]>('/content'),
  analytics: () => api<Analytics>('/analytics'),
};

const ROUTE_PREFETCH: Record<string, (keyof typeof fetchers)[]> = {
  '/': ['leads', 'analytics'],
  '/approve': ['leads'],
  '/approved': ['approved'],
  '/conversations': ['conversations'],
  '/meetings': ['meetings'],
  '/analytics': ['analytics', 'leads'],
  '/content': ['content'],
};

export function prefetchRoute(path: string) {
  for (const name of ROUTE_PREFETCH[path] ?? []) {
    // Every fetcher's query key is just its name (see `keys`).
    queryClient.prefetchQuery({ queryKey: [name], queryFn: fetchers[name] as () => Promise<unknown> });
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const isSourcing = (d?: LeadsResponse) =>
  d?.sourcing?.mode === 'live' && ['queued', 'running', 'enriching'].includes(d.sourcing.status);

export const useLeads = () =>
  useQuery({
    queryKey: keys.leads,
    queryFn: fetchers.leads,
    // While the scraper is gathering real companies, poll so new cards stream in.
    refetchInterval: (q) => (isSourcing(q.state.data) ? (q.state.data?.leads.length ? 20_000 : 4_000) : false),
  });

export const useNews = (industry: string) =>
  useQuery({
    queryKey: keys.news(industry),
    queryFn: () => api<NewsArticle[]>(`/trade-news?industry=${encodeURIComponent(industry)}`, { auth: false }),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

export const useApprovedLeads = () => useQuery({ queryKey: keys.approved, queryFn: fetchers.approved });

export const useConversations = () =>
  useQuery({ queryKey: keys.conversations, queryFn: fetchers.conversations, refetchInterval: 30_000 });

export const useConversation = (id: string | null) =>
  useQuery({
    queryKey: keys.conversation(id ?? ''),
    queryFn: () => api<ConversationDetail>(`/conversations/${id}`),
    enabled: !!id,
    staleTime: 5_000,
    // Poll while the AI is still drafting the opener.
    refetchInterval: (q) => (q.state.data?.conversation.stage === 'drafting' ? 2_000 : 30_000),
  });

export const useMeetings = () => useQuery({ queryKey: keys.meetings, queryFn: fetchers.meetings });
export const useContent = () => useQuery({ queryKey: keys.content, queryFn: fetchers.content });
export const useContentSuggestions = () =>
  useQuery({ queryKey: keys.suggestions, queryFn: () => api<ContentSuggestion[]>('/content/suggestions'), staleTime: 10 * 60_000 });
export const useAnalytics = () => useQuery({ queryKey: keys.analytics, queryFn: fetchers.analytics });
export const useIndustries = () =>
  useQuery({ queryKey: keys.industries, queryFn: () => api<string[]>('/meta/industries', { auth: false }), staleTime: Infinity });

export const useLeadInsight = (id: string | undefined) =>
  useQuery({
    queryKey: ['insight', id],
    queryFn: () => api<{ insight: string }>(`/leads/${id}/insight`),
    enabled: !!id,
    staleTime: Infinity,
  });

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useDecision() {
  const qc = useQueryClient();
  return useMutation({
    meta: { errorTitle: "Couldn't save your swipe" },
    mutationFn: ({ lead, decision }: { lead: Lead; decision: Decision }) =>
      api<{ status: Decision; conversation_id: string | null; inferred_reason: string | null }>(`/leads/${lead.id}/decision`, {
        body: { decision, lead },
      }),
    onSuccess: (_res, { decision }) => {
      if (decision === 'approved') {
        qc.invalidateQueries({ queryKey: keys.approved });
        qc.invalidateQueries({ queryKey: keys.conversations });
      }
      qc.invalidateQueries({ queryKey: keys.analytics });
    },
  });
}

export function useRejectionFeedback() {
  const qc = useQueryClient();
  return useMutation({
    meta: { errorTitle: "Couldn't save the reason" },
    mutationFn: ({ leadId, reason }: { leadId: string; reason: string }) =>
      api(`/leads/${leadId}/feedback`, { body: { reason } }),
    // A stated reason changes the ranking right away.
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.leads }),
  });
}

export function useUndoDecision() {
  const qc = useQueryClient();
  return useMutation({
    meta: { errorTitle: "Couldn't undo that swipe" },
    mutationFn: (leadId: string) => api(`/leads/${leadId}/decision`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.leads });
      qc.invalidateQueries({ queryKey: keys.approved });
      qc.invalidateQueries({ queryKey: keys.conversations });
      qc.invalidateQueries({ queryKey: keys.analytics });
    },
  });
}

function useConversationMutation<TVars, TRes>(
  convId: string,
  fn: (vars: TVars) => Promise<TRes>,
  errorTitle: string,
) {
  const qc = useQueryClient();
  return useMutation({
    meta: { errorTitle },
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.conversation(convId) });
      qc.invalidateQueries({ queryKey: keys.conversations });
      // Analysis is refreshed in a background task; pick it up shortly after.
      window.setTimeout(() => qc.invalidateQueries({ queryKey: keys.conversation(convId) }), 2500);
    },
  });
}

export const useSendMessage = (convId: string) =>
  useConversationMutation(convId, (vars: { content: string; sender: 'user' | 'lead' }) =>
    api<Message[]>(`/conversations/${convId}/messages`, { body: vars }),
    'Message not sent',
  );

export const useApproveDraft = (convId: string) =>
  useConversationMutation(convId, (vars: { id: string; content?: string }) =>
    api<Message>(`/conversations/${convId}/messages/${vars.id}/approve`, { body: { content: vars.content } }),
    "Couldn't approve the draft",
  );

export const useDiscardDraft = (convId: string) =>
  useConversationMutation(convId, (id: string) =>
    api(`/conversations/${convId}/messages/${id}`, { method: 'DELETE' }),
    "Couldn't discard the draft",
  );

export const useFollowUp = (convId: string) =>
  useConversationMutation(convId, () => api<Message>(`/conversations/${convId}/follow-up`, { body: {} }), "Couldn't draft a follow-up");

export const useUpdateConversation = (convId: string) =>
  useConversationMutation(convId, (patch: Partial<Pick<Conversation, 'ai_handling' | 'status' | 'channel'>> & { contact_email?: string }) =>
    api<Conversation>(`/conversations/${convId}`, { method: 'PATCH', body: patch }),
    "Couldn't update the conversation",
  );

export const suggestReply = (convId: string, instruction = '') =>
  api<{ content: string }>(`/conversations/${convId}/suggest`, { body: { instruction } });

function useListMutation<TVars, TRes>(
  key: readonly unknown[],
  fn: (v: TVars) => Promise<TRes>,
  errorTitle: string,
  also: readonly unknown[][] = [],
) {
  const qc = useQueryClient();
  return useMutation({
    meta: { errorTitle },
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      also.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export const useCreateMeeting = () =>
  useListMutation(keys.meetings, (body: { conversation_id: string; title: string; date: string; duration: number; meeting_link?: string; notes?: string }) =>
    api<Meeting>('/meetings', { body }), "Couldn't schedule the meeting", [[...keys.conversations], [...keys.analytics]]);

export const useUpdateMeeting = () =>
  useListMutation(keys.meetings, ({ id, ...patch }: Partial<Meeting> & { id: string }) =>
    api<Meeting>(`/meetings/${id}`, { method: 'PATCH', body: patch }), "Couldn't update the meeting", [[...keys.analytics]]);

export const useMeetingAction = () =>
  useListMutation(keys.meetings, ({ id, action }: { id: string; action: 'summary' | 'follow-up' }) =>
    api<Meeting>(`/meetings/${id}/${action}`, { body: {} }), 'The AI request failed', [[...keys.conversations]]);

export const useCreatePost = () =>
  useListMutation(keys.content, (body: { content: string; status: ContentPost['status']; scheduled_date?: string | null; source_headline?: string }) =>
    api<ContentPost>('/content', { body }), "Couldn't save the post");

export const useUpdatePost = () =>
  useListMutation(keys.content, ({ id, ...patch }: Partial<ContentPost> & { id: string }) =>
    api<ContentPost>(`/content/${id}`, { method: 'PATCH', body: patch }), "Couldn't update the post");

export const useDeletePost = () =>
  useListMutation(keys.content, (id: string) => api(`/content/${id}`, { method: 'DELETE' }), "Couldn't delete the post");

export const generatePost = (body: { topic?: string; headline?: string; tone?: string }) =>
  api<{ content: string; source_headline: string }>('/content/generate', { body });

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    meta: { errorTitle: "Couldn't save your profile" },
    mutationFn: (patch: Partial<User>) => api<User>('/user/profile', { method: 'PUT', body: patch }),
    onSuccess: (user) => {
      useSession.getState().updateUser(user);
      // Industry / country drive ranking and news.
      qc.invalidateQueries({ queryKey: keys.leads });
      qc.invalidateQueries({ queryKey: ['news'] });
      qc.invalidateQueries({ queryKey: keys.suggestions });
    },
  });
}
