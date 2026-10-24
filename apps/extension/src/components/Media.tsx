import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import { useEffect, useState } from 'react';
import { useT } from '@/i18n';
import { fmtDuration, mediaUrl } from '@/lib/format';
import type { Media } from '@/lib/types';
import { cn } from './ui/primitives';

function Tile({ m, onOpen, className, tall }: { m: Media; onOpen: () => void; className?: string; tall?: boolean }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const isVideo = m.type !== 'photo' && m.videoUrl;
  if (playing && isVideo) {
    return (
      <video
        src={m.videoUrl}
        poster={mediaUrl(m.url, 'medium')}
        className={cn('size-full bg-black object-contain', className)}
        controls={m.type === 'video'}
        autoPlay
        muted={m.type === 'gif'}
        loop={m.type === 'gif'}
        playsInline
        onClick={(e) => e.stopPropagation()}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (isVideo) setPlaying(true);
        else onOpen();
      }}
      className={cn('group/tile relative block size-full overflow-hidden bg-panel-2', className)}
      aria-label={m.alt || (m.type === 'photo' ? t('media.openImage') : t('media.playVideo'))}
    >
      <img
        src={mediaUrl(m.url, tall ? 'large' : 'medium')}
        alt={m.alt ?? ''}
        loading="lazy"
        decoding="async"
        className="size-full object-cover transition-transform duration-500 group-hover/tile:scale-[1.025]"
      />
      {m.type !== 'photo' ? (
        <>
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-12 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-hover/tile:scale-110">
              <Play className="size-5 translate-x-px fill-white" />
            </span>
          </span>
          <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {m.type === 'gif' ? 'GIF' : fmtDuration(m.durationMs) || t('media.video')}
          </span>
        </>
      ) : null}
    </button>
  );
}

export function MediaGrid({ media, className, compact }: { media: Media[]; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!media.length) return null;
  const items = media.slice(0, 4);
  const n = items.length;
  const first = items[0]!;
  const ratio = first.width && first.height ? first.width / first.height : 16 / 9;

  return (
    <>
      <div
        className={cn('overflow-hidden rounded-[14px] border border-line', n > 1 && 'grid gap-0.5', n === 2 && 'grid-cols-2', n >= 3 && 'grid-cols-2 grid-rows-2', className)}
        style={n === 1 ? { aspectRatio: String(Math.max(0.75, Math.min(ratio, 2))), maxHeight: compact ? 260 : 440 } : { aspectRatio: n === 2 ? '16 / 9' : '4 / 3' }}
      >
        {items.map((m, i) => (
          <Tile key={m.url + i} m={m} tall={n === 1} onOpen={() => setOpen(i)} className={cn(n === 3 && i === 0 && 'row-span-2')} />
        ))}
      </div>
      {open !== null ? (
        <Lightbox media={media.filter((m) => m.type === 'photo')} index={Math.max(0, media.filter((m) => m.type === 'photo').indexOf(items[open]!))} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

export function Lightbox({ media, index, onClose }: { media: Media[]; index: number | null; onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(index ?? 0);
  useEffect(() => {
    if (index !== null) setI(index);
  }, [index]);
  const open = index !== null && media.length > 0;
  const m = media[i];
  const go = (d: number) => setI((x) => (x + d + media.length) % media.length);

  return (
    <D.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <D.Content
          className="fixed inset-0 z-[91] grid place-items-center p-6 outline-none"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
          }}
        >
          <D.Title className="sr-only">{t('media.image')}</D.Title>
          <D.Description className="sr-only">{m?.alt ?? t('media.imageFromPost')}</D.Description>
          {m ? <img src={mediaUrl(m.url, 'orig')} alt={m.alt ?? ''} className="max-h-[92vh] max-w-[92vw] animate-fade-in rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} /> : null}
          {media.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => (e.stopPropagation(), go(-1))}
                className="absolute top-1/2 left-4 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label={t('common.previous')}
              >
                <ChevronLeft />
              </button>
              <button
                type="button"
                onClick={(e) => (e.stopPropagation(), go(1))}
                className="absolute top-1/2 right-4 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label={t('common.next')}
              >
                <ChevronRight />
              </button>
            </>
          ) : null}
          <D.Close className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label={t('common.close')}>
            <X className="size-5" />
          </D.Close>
          {m?.alt ? <p className="absolute bottom-6 max-w-2xl rounded-lg bg-black/60 px-3 py-2 text-center text-sm text-white">{m.alt}</p> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
