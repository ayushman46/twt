/**
 * Locale-aware formatting. Follows the active UI language (see @/i18n):
 * Indian languages and en-IN get Indian grouping (1,23,456) and lakh/crore
 * compact numbers; dates use the language's month and weekday names.
 * Intl formatters are cached per locale.
 */
import { getFormatLocale, getLocale, numberFormat, t } from '@/i18n/core';

const DAY = 86_400_000;

/* ----------------------------------------------------------- Numbers */

/** Locales whose CLDR compact form uses million/billion instead of lakh/crore. */
const LAKH_WORDS: Record<string, { lakh: [string, string]; crore: [string, string] }> = {
  te: { lakh: ['లక్ష', 'లక్షలు'], crore: ['కోటి', 'కోట్లు'] },
  ta: { lakh: ['லட்சம்', 'லட்சம்'], crore: ['கோடி', 'கோடி'] },
  kn: { lakh: ['ಲಕ್ಷ', 'ಲಕ್ಷ'], crore: ['ಕೋಟಿ', 'ಕೋಟಿ'] },
  ml: { lakh: ['ലക്ഷം', 'ലക്ഷം'], crore: ['കോടി', 'കോടി'] },
};

/** "1.2K", "1.2L", "3.4Cr", "1.2 लाख", "3.4 करोड़" — numbers under 1,000 stay exact. */
export function fmtCompact(n: number): string {
  if (n < 1000) return String(n);
  const loc = getLocale();
  if (loc === 'en') return numberFormat({ notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const words = LAKH_WORDS[loc];
  if (words && n >= 100_000) {
    const crore = n >= 10_000_000;
    const v = n / (crore ? 10_000_000 : 100_000);
    const [one, many] = crore ? words.crore : words.lakh;
    return `${numberFormat({ maximumFractionDigits: 1 }).format(v)} ${v === 1 ? one : many}`;
  }
  // Long forms read naturally in Indian languages: "1.2 हज़ार", "3.4 करोड़".
  return numberFormat({ notation: 'compact', compactDisplay: 'long', maximumFractionDigits: 1 }).format(n);
}

/** Full number with grouping: 1,234,567 (en-US) or 12,34,567 (Indian). */
export function fmtNumber(n: number): string {
  return getLocale() === 'en' ? numberFormat().format(n) : numberFormat(undefined, 'en-IN').format(n);
}

/* ------------------------------------------------------------- Dates */

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** Cached Intl.DateTimeFormat for the active locale. */
export function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const loc = getFormatLocale();
  const id = `${loc}|${JSON.stringify(options)}`;
  let f = dateFormats.get(id);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(loc, options);
    } catch {
      f = new Intl.DateTimeFormat('en-US', options);
    }
    dateFormats.set(id, f);
  }
  return f;
}

export function fmtDate(ms: number | Date, options: Intl.DateTimeFormatOptions): string {
  return dateFormat(options).format(ms);
}

function isThisYear(ms: number): boolean {
  return new Date(ms).getFullYear() === new Date().getFullYear();
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Mar 4" / "4 मार्च" */
export function fmtMonthDay(ms: number | Date): string {
  return fmtDate(ms, { month: 'short', day: 'numeric' });
}

/** "Saturday, October 24" / "शनिवार, 24 अक्तूबर" */
export function fmtWeekdayDate(ms: number | Date): string {
  return fmtDate(ms, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** "3:45 PM" / "3:45 pm" */
export function fmtTime(ms: number | Date): string {
  return fmtDate(ms, { hour: 'numeric', minute: '2-digit' });
}

/** "2h", "3d", "Mar 4", "Mar 4, 2023" — like X's timestamps ("2 घं॰", "4 मार्च"). */
export function fmtShortDate(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return fmtMonthDay(ms);
  if (diff < 60_000) return t('time.now');
  const unitDisplay = getLocale() === 'en' ? 'narrow' : 'short';
  if (diff < 3_600_000) return numberFormat({ style: 'unit', unit: 'minute', unitDisplay }).format(Math.floor(diff / 60_000));
  if (diff < DAY) return numberFormat({ style: 'unit', unit: 'hour', unitDisplay }).format(Math.floor(diff / 3_600_000));
  if (diff < 7 * DAY) return numberFormat({ style: 'unit', unit: 'day', unitDisplay }).format(Math.floor(diff / DAY));
  return isThisYear(ms) ? fmtMonthDay(ms) : fmtDate(ms, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Mar 4, 2023, 3:45 PM" / "4 मार्च 2023, 3:45 pm" */
export function fmtLongDate(ms: number): string {
  return fmtDate(ms, { dateStyle: 'medium', timeStyle: 'short' });
}

const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

function relative(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  const loc = getFormatLocale();
  let f = relativeFormats.get(loc);
  if (!f) {
    try {
      f = new Intl.RelativeTimeFormat(loc, { numeric: 'always' });
    } catch {
      f = new Intl.RelativeTimeFormat('en-US', { numeric: 'always' });
    }
    relativeFormats.set(loc, f);
  }
  return f.format(value, unit);
}

/** "today at 3:45 PM", "yesterday at …", "3 days ago" / "आज 3:45 pm पर", "3 दिन पहले". */
export function fmtRelative(ms: number): string {
  const today = startOfDay(Date.now());
  if (ms >= today && ms < today + DAY) return t('time.todayAt', { time: fmtTime(ms) });
  if (ms >= today - DAY && ms < today) return t('time.yesterdayAt', { time: fmtTime(ms) });
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const sign = diff >= 0 ? -1 : 1;
  if (abs < 60_000) return relative(sign * Math.round(abs / 1000), 'second');
  if (abs < 3_600_000) return relative(sign * Math.round(abs / 60_000), 'minute');
  if (abs < DAY) return relative(sign * Math.round(abs / 3_600_000), 'hour');
  if (abs < 30 * DAY) return relative(sign * Math.round(abs / DAY), 'day');
  if (abs < 365 * DAY) return relative(sign * Math.max(1, Math.round(abs / (30.44 * DAY))), 'month');
  return relative(sign * Math.max(1, Math.round(abs / (365.25 * DAY))), 'year');
}

export function fmtDuration(ms?: number): string {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** English-only pluralizer kept for older callers; UI code uses t('…', { count }). */
export function plural(n: number, one: string, many = one + 's'): string {
  return `${fmtNumber(n)} ${n === 1 ? one : many}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return t('greeting.night');
  if (h < 12) return t('greeting.morning');
  if (h < 18) return t('greeting.afternoon');
  return t('greeting.evening');
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
