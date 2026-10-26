import { ChevronDown, Heart, RefreshCw, Square, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { t, useT } from '@/i18n';
import { send } from '@/lib/messages';
import { fmtNumber, fmtRelative } from '@/lib/format';
import { isSyncActive, lastSyncItem, type SyncMode } from '@/lib/storage';
import type { Source } from '@/lib/types';
import { useStorageItem, useSyncState } from '@/hooks/data';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from './ui/overlays';
import { Button, cn } from './ui/primitives';

export async function startSync(source: Source = 'bookmark', mode: SyncMode = 'quick') {
  try {
    const res = await send('sync/start', { source, mode });
    if (!res.ok) toast.error(res.error ?? t('sync.couldNotStart'));
    else toast(source === 'like' ? t('sync.openingLikes') : t('sync.openingBookmarks'), { description: t('sync.openingDesc') });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : t('sync.couldNotStart'));
  }
}

const HEIGHT = { sm: 'h-8', md: 'h-9', lg: 'h-11' } as const;

/**
 * One primary sync button, with a small sibling dropdown for the other modes.
 * The dropdown trigger is a sibling of the primary button, never a child of it.
 */
export function SyncButton({ className, size = 'sm', hasData }: { className?: string; size?: 'sm' | 'md' | 'lg'; hasData: boolean }) {
  useT();
  const state = useSyncState();
  const active = isSyncActive(state);
  const square = cn('w-8', HEIGHT[size]);

  if (active) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Button size={size} variant="soft" className="min-w-0 flex-1" onClick={() => void startSync(state.source, state.mode)}>
          <RefreshCw className="animate-spin" />
          <span className="truncate">{state.found ? t('sync.syncingCount', { count: fmtNumber(state.found) }) : t('sync.syncing')}</span>
        </Button>
        <Button size="icon" variant="secondary" className={square} aria-label={t('sync.stop')} onClick={() => void send('sync/stop', {})}>
          <Square className="!size-3 fill-current" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Button size={size} variant="primary" className="min-w-0 flex-1" onClick={() => void startSync('bookmark', hasData ? 'quick' : 'full')}>
        <RefreshCw /> <span className="truncate">{hasData ? t('sync.sync') : t('sync.syncBookmarks')}</span>
      </Button>
      <Menu>
        <MenuTrigger asChild>
          <Button size="icon" variant="secondary" className={square} aria-label={t('sync.moreOptions')}>
            <ChevronDown />
          </Button>
        </MenuTrigger>
        <MenuContent className="w-72">
          <MenuItem onSelect={() => void startSync('bookmark', 'quick')}>
            <Zap />
            <div>
              <div className="font-medium">{t('sync.quick')}</div>
              <div className="text-[12px] text-muted">{t('sync.quickDesc')}</div>
            </div>
          </MenuItem>
          <MenuItem onSelect={() => void startSync('bookmark', 'full')} className="h-auto py-2">
            <RefreshCw />
            <div>
              <div className="font-medium">{t('sync.full')}</div>
              <div className="text-[12px] text-muted">{t('sync.fullDesc')}</div>
            </div>
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={() => void startSync('like', 'full')} className="h-auto py-2">
            <Heart />
            <div>
              <div className="font-medium">{t('sync.importLikes')}</div>
              <div className="text-[12px] text-muted">{t('sync.importLikesDesc')}</div>
            </div>
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

export function LastSynced({ className }: { className?: string }) {
  useT();
  const last = useStorageItem(lastSyncItem, { bookmark: null, like: null });
  const state = useSyncState();
  if (isSyncActive(state)) return <span className={cn('text-[12px] text-muted', className)}>{t('sync.inXTab')}</span>;
  return <span className={cn('text-[12px] text-muted', className)}>{last.bookmark ? t('sync.synced', { when: fmtRelative(last.bookmark) }) : t('sync.never')}</span>;
}
