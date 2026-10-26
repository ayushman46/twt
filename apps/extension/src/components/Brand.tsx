import { BadgeCheck } from 'lucide-react';
import { useState } from 'react';
import { t } from '@/i18n/core';
import { avatarUrl, initials } from '@/lib/format';
import { cn } from './ui/primitives';

/** twtdash mark: a flat accent tile, a white bookmark and an accent pill cut into it. Same geometry as the toolbar icon. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" className={cn('size-7 shrink-0', className)} aria-hidden="true">
      <rect width="128" height="128" rx="28" className="fill-accent" />
      <path transform="translate(-2 0)" d="M44 24h44a7 7 0 0 1 7 7v71.2a3.2 3.2 0 0 1-5 2.6L66 88 42 104.8a3.2 3.2 0 0 1-5-2.6V31a7 7 0 0 1 7-7z" className="fill-white" />
      <rect x="52" y="49" width="24" height="9" rx="4.5" className="fill-accent" />
    </svg>
  );
}

/** The name, set in one colour. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn('font-semibold tracking-[-0.02em] text-fg', className)}>twtdash</span>;
}

export function Avatar({ src, name, handle, size = 40, className }: { src?: string; name: string; handle: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = src && !failed ? avatarUrl(src, size > 48 ? '200x200' : 'bigger') : '';
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-panel-2 font-medium text-muted select-none ring-1 ring-line',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {url ? <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" onError={() => setFailed(true)} /> : initials(name || handle)}
    </span>
  );
}

export function Verified({ className }: { className?: string }) {
  return <BadgeCheck className={cn('size-4 shrink-0 fill-[#1D9BF0] text-white', className)} aria-label={t('brand.verified')} />;
}
