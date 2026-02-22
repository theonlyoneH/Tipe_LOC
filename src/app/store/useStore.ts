import { create } from 'zustand';

export interface Lead {
  id: string;
  company_name: string;
  industry: string;
  location: string;
  vector_score: number;
  intent_score: number;
  trade_momentum_index: number;
  match_percentage: number;
  firmographics_hash?: string;
  trust_verified: boolean;
  company_size: string;
  estimated_value: string;
  ai_reasoning?: string;
  outreach_template?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  contact_person?: string;
  email?: string;
  phone?: string;
  country?: string;
  revenue?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: 'user' | 'lead' | 'ai';
  content: string;
  timestamp: Date;
  channel: 'email' | 'linkedin' | 'whatsapp' | 'call';
}

export interface Conversation {
  id: string;
  leadId: string;
  leadName: string;
  leadCompany: string;
  channel: 'email' | 'linkedin' | 'whatsapp' | 'call';
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  aiHandling: boolean;
  status: 'active' | 'archived';
}

export interface Meeting {
  id: string;
  leadId: string;
  leadName: string;
  leadCompany: string;
  title: string;
  date: Date;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  meetingLink?: string;
  aiSummary?: string;
  followUpSent?: boolean;
}

export interface ContentPost {
  id: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published';
  scheduledDate?: Date;
  publishedDate?: Date;
  engagementRate?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

interface StoreState {
  leads: Lead[];
  approvedLeads: Lead[];
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  meetings: Meeting[];
  contentPosts: ContentPost[];
  stats: {
    activeLeads: number;
    responseRate: number;
    meetingsScheduled: number;
    conversionRate: number;
    approvalRate: number;
  };

  // Actions
  setLeads: (leads: Lead[]) => void;
  setApprovedLeads: (leads: Lead[]) => void;
  updateLeadStatus: (leadId: string, status: Lead['status']) => void;
  addConversation: (conversation: Conversation) => void;
  addMessage: (conversationId: string, message: Message) => void;
  toggleAIHandling: (conversationId: string) => void;
  addMeeting: (meeting: Meeting) => void;
  updateMeetingStatus: (meetingId: string, status: Meeting['status']) => void;
  addContentPost: (post: ContentPost) => void;
  updateContentPost: (postId: string, updates: Partial<ContentPost>) => void;
  updateStats: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
  leads: [],
  approvedLeads: [],
  conversations: [],
  messages: {},
  meetings: [],
  contentPosts: [],
  stats: {
    activeLeads: 0,
    responseRate: 0,
    meetingsScheduled: 0,
    conversionRate: 0,
    approvalRate: 0,
  },

  setLeads: (leads) => {
    set({ leads });
    get().updateStats();
  },

  setApprovedLeads: (approvedLeads) => {
    set({ approvedLeads });
  },

  updateLeadStatus: (leadId, status) => {
    set((state) => {
      const leads = state.leads.map((lead) =>
        lead.id === leadId ? { ...lead, status } : lead
      );

      const approvedLeads = status === 'approved'
        ? [...state.approvedLeads, leads.find(l => l.id === leadId)!]
        : state.approvedLeads;

      return { leads, approvedLeads };
    });
    get().updateStats();
  },

  addConversation: (conversation) => {
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    }));
  },

  addMessage: (conversationId, message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), message],
      },
    }));
  },

  toggleAIHandling: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, aiHandling: !conv.aiHandling } : conv
      ),
    }));
  },

  addMeeting: (meeting) => {
    set((state) => ({
      meetings: [...state.meetings, meeting],
    }));
    get().updateStats();
  },

  updateMeetingStatus: (meetingId, status) => {
    set((state) => ({
      meetings: state.meetings.map((meeting) =>
        meeting.id === meetingId ? { ...meeting, status } : meeting
      ),
    }));
  },

  addContentPost: (post) => {
    set((state) => ({
      contentPosts: [...state.contentPosts, post],
    }));
  },

  updateContentPost: (postId, updates) => {
    set((state) => ({
      contentPosts: state.contentPosts.map((post) =>
        post.id === postId ? { ...post, ...updates } : post
      ),
    }));
  },

  updateStats: () => {
    const state = get();
    const totalLeads = state.leads.length;
    const approvedCount = state.leads.filter(l => l.status === 'approved').length;
    const activeConversations = state.conversations.filter(c => c.status === 'active').length;
    const completedMeetings = state.meetings.filter(m => m.status === 'completed').length;

    set({
      stats: {
        activeLeads: state.leads.filter(l => l.status === 'pending').length,
        responseRate: activeConversations > 0 ? (activeConversations / approvedCount) * 100 : 0,
        meetingsScheduled: state.meetings.filter(m => m.status === 'scheduled').length,
        conversionRate: completedMeetings > 0 ? (completedMeetings / approvedCount) * 100 : 0,
        approvalRate: totalLeads > 0 ? (approvedCount / totalLeads) * 100 : 0,
      },
    });
  },
}));
