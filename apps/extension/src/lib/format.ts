import { format, formatDistanceToNowStrict, isThisYear, isToday, isYesterday } from 'date-fns';

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat();

export function fmtCompact(n: number): string {
  return n < 1000 ? String(n) : compact.format(n);
}

export function fmtNumber(n: number): string {
  return full.format(n);
}

/** "2h", "3d", "Mar 4", "Mar 4, 2023" — like X's timestamps. */
export function fmtShortDate(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return format(ms, 'MMM d');
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d`;
  return isThisYear(ms) ? format(ms, 'MMM d') : format(ms, 'MMM d, yyyy');
}

export function fmtLongDate(ms: number): string {
  return format(ms, "MMM d, yyyy 'at' h:mm a");
}

export function fmtRelative(ms: number): string {
  if (isToday(ms)) return `today at ${format(ms, 'h:mm a')}`;
  if (isYesterday(ms)) return `yesterday at ${format(ms, 'h:mm a')}`;
  return `${formatDistanceToNowStrict(ms)} ago`;
}

export function fmtDuration(ms?: number): string {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${fmtNumber(n)} ${n === 1 ? one : many}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => Array.from(w)[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  );
}

/** Larger avatar variant from X's CDN. */
export function avatarUrl(url: string, size: 'normal' | 'bigger' | '200x200' | '400x400' = 'bigger'): string {
  return url ? url.replace(/_(normal|bigger|mini|200x200|400x400)\./, `_${size}.`) : '';
}

/** X image URL at a given size. */
export function mediaUrl(url: string, name: 'small' | 'medium' | 'large' | 'orig' = 'medium'): string {
  if (!url.includes('pbs.twimg.com')) return url;
  if (url.includes('name=')) return url.replace(/name=\w+/, `name=${name}`);
  const m = url.match(/^(.*)\.(jpg|jpeg|png|webp)$/i);
  return m ? `${m[1]}?format=${m[2]!.toLowerCase() === 'png' ? 'png' : 'jpg'}&name=${name}` : url;
}
