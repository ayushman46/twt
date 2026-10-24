import { BadgeCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { t } from '@/i18n/core';
import { avatarUrl, initials } from '@/lib/format';
import { cn } from './ui/primitives';

/** twtdash mark: gradient squircle, bookmark with an X-shaped spark. */
export function Logo({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 128 128" className={cn('size-7 shrink-0', className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7B61FF" />
          <stop offset=".55" stopColor="#B14CF2" />
          <stop offset="1" stopColor="#FF5C9D" />
        </linearGradient>
        <linearGradient id={`${id}gl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}mk`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6D4BFF" />
          <stop offset="1" stopColor="#E0479A" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="30" fill={`url(#${id}bg)`} />
      <rect width="128" height="64" rx="30" fill={`url(#${id}gl)`} />
      <rect x="31" y="27" width="56" height="74" rx="10" fill="#fff" fillOpacity=".28" transform="rotate(-10 59 64)" />
      <path d="M44 24h44a7 7 0 0 1 7 7v71.2a3.2 3.2 0 0 1-5 2.6L66 88 42 104.8a3.2 3.2 0 0 1-5-2.6V31a7 7 0 0 1 7-7z" fill="#fff" />
      <path d="M53 41.5Q66 51.5 79 41.5Q69 54.5 79 67.5Q66 57.5 53 67.5Q63 54.5 53 41.5Z" fill={`url(#${id}mk)`} />
    </svg>
  );
}

/** "twt" + gradient "dash". */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-semibold tracking-[-0.03em]', className)}>
      twt<span className="text-brand">dash</span>
    </span>
  );
}

const GRADIENTS = [
  ['#7B61FF', '#22D3EE'],
  ['#F97316', '#EC4899'],
  ['#10B981', '#3B82F6'],
  ['#EAB308', '#F97316'],
  ['#A855F7', '#EC4899'],
  ['#06B6D4', '#6366F1'],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ src, name, handle, size = 40, className }: { src?: string; name: string; handle: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = src && !failed ? avatarUrl(src, size > 48 ? '200x200' : 'bigger') : '';
  const [a, b] = GRADIENTS[hash(handle || name) % GRADIENTS.length]!;
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-panel-2 font-semibold text-white select-none ring-1 ring-black/5 dark:ring-white/10',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundImage: url ? undefined : `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {url ? <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" onError={() => setFailed(true)} /> : initials(name || handle)}
    </span>
  );
}

export function Verified({ className }: { className?: string }) {
  return <BadgeCheck className={cn('size-4 shrink-0 fill-[#1D9BF0] text-white', className)} aria-label={t('brand.verified')} />;
}
