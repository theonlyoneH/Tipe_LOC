// Format large numbers with K/M suffix
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

// Calculate color based on score
export function getScoreColor(score: number): string {
  if (score >= 0.9) return 'text-green-600';
  if (score >= 0.8) return 'text-blue-600';
  if (score >= 0.7) return 'text-orange-600';
  return 'text-red-600';
}

// Calculate background color based on score
export function getScoreBgColor(score: number): string {
  if (score >= 0.9) return 'bg-green-100';
  if (score >= 0.8) return 'bg-blue-100';
  if (score >= 0.7) return 'bg-orange-100';
  return 'bg-red-100';
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Generate random color for avatars
export function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-green-500',
    'bg-orange-500',
    'bg-cyan-500',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

// Format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Calculate percentage
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

// Get channel color
export function getChannelColor(channel: string): string {
  const colors: Record<string, string> = {
    email: 'bg-blue-600',
    linkedin: 'bg-blue-700',
    whatsapp: 'bg-green-500',
    call: 'bg-purple-600',
  };
  return colors[channel] || 'bg-slate-600';
}

// Sleep function for delays
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
