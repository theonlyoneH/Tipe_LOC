import { formatDistanceToNowStrict } from 'date-fns';
import { Linkedin, Mail, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import type { Channel, NewsArticle } from './types';

export function formatMoney(v: number | undefined | null): string {
  if (!v) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}

export const pct = (v: number | undefined | null) => `${Math.round((v ?? 0) * 100)}%`;

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : formatDistanceToNowStrict(d, { addSuffix: true });
}

export const CHANNELS: Record<Channel, { label: string; icon: LucideIcon; badge: string; color: string }> = {
  email: { label: 'Email', icon: Mail, badge: 'bg-blue-100 text-blue-700', color: '#3b82f6' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, badge: 'bg-sky-100 text-sky-800', color: '#0a66c2' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, badge: 'bg-green-100 text-green-700', color: '#22c55e' },
  call: { label: 'Call', icon: Phone, badge: 'bg-purple-100 text-purple-700', color: '#8b5cf6' },
};

export function channelOf(value: string | null | undefined): Channel {
  const v = (value ?? '').toLowerCase();
  if (v.includes('link')) return 'linkedin';
  if (v.includes('whats') || v.includes('sms')) return 'whatsapp';
  if (v.includes('call') || v.includes('phone')) return 'call';
  return 'email';
}

export const SIGNAL_STYLE: Record<NewsArticle['signal'], { dot: string; label: string; text: string }> = {
  opportunity: { dot: 'bg-emerald-400', label: 'Opportunity', text: 'text-emerald-600' },
  risk: { dot: 'bg-red-400', label: 'Risk', text: 'text-red-600' },
  tariff: { dot: 'bg-amber-400', label: 'Tariff', text: 'text-amber-600' },
  neutral: { dot: 'bg-slate-400', label: 'Update', text: 'text-slate-500' },
};

export const STAGE_LABEL: Record<string, string> = {
  drafting: 'AI drafting',
  draft_ready: 'Draft ready',
  draft_failed: 'Draft failed',
  contacted: 'Contacted',
  engaged: 'Engaged',
  meeting_requested: 'Wants a meeting',
  meeting_scheduled: 'Meeting set',
  negotiating: 'Negotiating',
  won: 'Won',
  lost: 'Lost',
};

const FLAGS: Record<string, string> = {
  USA: 'US', 'United States': 'US', UK: 'GB', 'United Kingdom': 'GB', Germany: 'DE', France: 'FR', India: 'IN',
  China: 'CN', Japan: 'JP', 'South Korea': 'KR', Canada: 'CA', Mexico: 'MX', Brazil: 'BR', Australia: 'AU',
  Netherlands: 'NL', Italy: 'IT', Spain: 'ES', UAE: 'AE', 'Saudi Arabia': 'SA', Singapore: 'SG', Vietnam: 'VN',
  Indonesia: 'ID', Turkey: 'TR', Russia: 'RU', Poland: 'PL', Sweden: 'SE', Switzerland: 'CH', 'South Africa': 'ZA',
  Bangladesh: 'BD', Thailand: 'TH', Malaysia: 'MY', Egypt: 'EG', Nigeria: 'NG', Israel: 'IL', Belgium: 'BE',
};

export function flag(country: string | undefined): string {
  const code = country ? FLAGS[country] ?? (country.length === 2 ? country.toUpperCase() : '') : '';
  if (!code) return '🌍';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** URL-safe, human-readable slug (e.g. "Hermès Paris" -> "hermes-paris"). */
export function slugify(text: string): string {
  return (text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents left by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'conversation';
}

/**
 * Readable, unique URL slugs for conversations so database IDs never appear in the
 * address bar (/conversations/hermes instead of /conversations/6ac4d2...).
 * Duplicate company names get -2, -3 ... in creation order, so slugs are stable.
 */
export function conversationSlugs(convs: { id: string; lead_company: string; created_at: string }[]) {
  const bySlug = new Map<string, string>();
  const byId = new Map<string, string>();
  const ordered = [...convs].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const counts = new Map<string, number>();
  for (const c of ordered) {
    const base = slugify(c.lead_company);
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    const slug = n === 1 ? base : `${base}-${n}`;
    bySlug.set(slug, c.id);
    byId.set(c.id, slug);
  }
  return { bySlug, byId };
}

export interface ChannelAction {
  href: string;
  label: string;
  hint?: string; // shown when we can't prefill the recipient
}

function splitSubject(text: string) {
  if (/^subject:/i.test(text)) {
    const [first, ...lines] = text.split(/\r?\n/);
    return { subject: first.replace(/^subject:\s*/i, ''), body: lines.join('\n').trim() };
  }
  return { subject: 'Partnership enquiry', body: text };
}

/** "Open in ..." link for a message. Always usable; prefilled with the recipient when we know it. */
export function channelLink(channel: Channel, contact: { email?: string; phone?: string; linkedin?: string }, text: string): ChannelAction | null {
  const encoded = encodeURIComponent(text);
  if (channel === 'email') {
    const { subject, body } = splitSubject(text);
    const qs = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return contact.email
      ? { href: `mailto:${contact.email}?${qs}`, label: 'Open in Email' }
      : { href: `mailto:?${qs}`, label: 'Open in Email', hint: 'Add the recipient in your mail app (or save their email under Insights)' };
  }
  if (channel === 'whatsapp') {
    return contact.phone
      ? { href: `https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encoded}`, label: 'Open in WhatsApp' }
      : { href: `https://wa.me/?text=${encoded}`, label: 'Open in WhatsApp', hint: 'Pick the contact in WhatsApp' };
  }
  if (channel === 'linkedin') {
    return contact.linkedin
      ? { href: contact.linkedin, label: 'Open LinkedIn profile', hint: 'Copy first, then paste into a LinkedIn message' }
      : { href: 'https://www.linkedin.com/messaging/', label: 'Open LinkedIn', hint: 'Copy first, then paste into a LinkedIn message' };
  }
  if (channel === 'call' && contact.phone) return { href: `tel:${contact.phone}`, label: 'Call' };
  return null;
}
