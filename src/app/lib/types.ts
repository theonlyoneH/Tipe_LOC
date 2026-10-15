export type Category = 'exporter' | 'importer';
export type Channel = 'email' | 'linkedin' | 'whatsapp' | 'call';
export type Decision = 'approved' | 'rejected' | 'skipped';

export interface User {
  email: string;
  category: Category;
  industry: string;
  country: string;
  company_name: string;
  description: string;
}

export interface NewsArticle {
  id: string;
  headline: string;
  url: string;
  source: string;
  published: string | null;
  summary: string;
  countries: string[];
  signal: 'opportunity' | 'risk' | 'tariff' | 'neutral';
  polarity: number;
  relevance: number;
  trade_signal_score: number;
  importance_tag: string;
}

export interface NewsReason {
  headline: string;
  url: string;
  source: string;
  impact: number;
  why: string;
}

export interface LeadContact {
  person: string;
  email: string;
  phone: string;
  linkedin: string;
  website: string;
}

export interface Lead {
  id: string;
  company_name: string;
  industry: string;
  country: string;
  revenue_usd: number;
  team_size: number;
  intent_score: number;
  response_probability: number;
  prompt_response: number;
  preferred_channel: string;
  certification: string;
  trust_verified: boolean;
  tariff_exposed: boolean;
  signals: string[];
  contact: LeadContact;
  base_score: number;
  news_score: number;
  semantic_score: number;
  preference_score: number;
  dynamic_score: number;
  match_percentage: number;
  news_reasons: NewsReason[];
  preference_note: string | null;
  ai_reasoning: string;
  rank_delta: number;
  skipped: boolean;
  war_risk?: boolean;
  market_shock?: boolean;
  model_probability?: number;
  score_breakdown: { label: string; delta: number }[];
  is_real?: boolean;
  data_source?: string;
  source_url?: string;
  city?: string;
  description?: string;
  /** What the company is to the user: exporters see buyers, importers see suppliers. */
  lead_role?: 'buyer' | 'supplier' | '';
  role_label?: string;
}

export interface Sourcing {
  mode: 'demo' | 'live';
  status: 'queued' | 'running' | 'enriching' | 'done' | 'failed';
  stage?: string;
  found?: number;
  enriched?: number;
  updated_at?: string | null;
  error?: string | null;
}

export type RegimeName = 'calm' | 'active' | 'boom' | 'shock';

export interface RankingEngine {
  regime: {
    name: RegimeName;
    intensity: number;
    risk_share: number;
    hot_countries: { country: string; polarity: number }[];
    summary: string;
  };
  pipeline: { name: string; label: string; trained_on?: number; top_features?: { feature: string; importance: number }[] }[];
  notes: string[];
  feedback: {
    decisions: number;
    approved: number;
    rejected: number;
    top_reject_reasons: { reason: string; label: string; weight: number }[];
  };
}

export interface LeadsResponse {
  leads: Lead[];
  total_candidates: number;
  news_used: number;
  learned_from_swipes: number;
  engine: RankingEngine;
  reject_reasons: { key: string; label: string }[];
  sourcing: Sourcing;
  generated_at: string;
}

export interface ApprovedLead extends Partial<Lead> {
  id: string;
  company_name: string;
  approved_at: string | null;
  conversation_id: string | null;
  outreach_stage: string | null;
  outreach_channel: Channel | null;
}

export interface ConversationAnalysis {
  sentiment: number;
  sentiment_label: string;
  stage: string;
  meeting_intent: boolean;
  next_action: string;
  summary: string;
}

export interface Conversation {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_company: string;
  country: string;
  channel: Channel;
  contact: Partial<LeadContact>;
  ai_handling: boolean;
  status: 'active' | 'archived';
  stage: string;
  unread: number;
  last_message: string;
  last_sender: string;
  match_percentage?: number;
  created_at: string;
  updated_at: string;
  analysis?: ConversationAnalysis;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai' | 'lead';
  content: string;
  channel: Channel;
  status: 'draft' | 'approved' | 'delivered' | 'received';
  created_at: string;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
  can_deliver: boolean;
}

export interface Meeting {
  id: string;
  conversation_id: string;
  lead_id: string;
  lead_name: string;
  lead_company: string;
  title: string;
  date: string;
  duration: number;
  meeting_link: string;
  notes: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  ai_summary: string;
  follow_up_sent: boolean;
}

export interface ContentPost {
  id: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published';
  scheduled_date: string | null;
  published_date: string | null;
  source_headline: string;
  created_at: string;
}

export interface ContentSuggestion {
  topic: string;
  angle: string;
  signal: string;
  url: string;
  engagement: 'High' | 'Medium';
}

export interface Analytics {
  decisions: Record<Decision, number>;
  approval_rate: number;
  conversations: number;
  contacted: number;
  responded: number;
  response_rate: number;
  meetings: { scheduled: number; completed: number; total: number };
  meeting_conversion: number;
  funnel: { stage: string; count: number }[];
  channels: { channel: string; contacted: number; responded: number; meetings: number }[];
  weekly: { week: string; approved: number; rejected: number; conversations: number; meetings: number }[];
  segments: { segment: string; approved: number; replies: number; reply_rate: number }[];
}
