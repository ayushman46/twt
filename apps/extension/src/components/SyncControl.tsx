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

export function SyncButton({ className, size = 'sm', hasData }: { className?: string; size?: 'sm' | 'md' | 'lg'; hasData: boolean }) {
  useT();
  const state = useSyncState();
  const active = isSyncActive(state);

  if (active) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Button size={size} variant="soft" onClick={() => void startSync(state.source, state.mode)}>
          <RefreshCw className="animate-spin" />
          {state.found ? t('sync.syncingCount', { count: fmtNumber(state.found) }) : t('sync.syncing')}
        </Button>
        <Button size={size === 'lg' ? 'icon' : 'icon-sm'} variant="ghost" aria-label={t('sync.stop')} onClick={() => void send('sync/stop', {})}>
          <Square className="!size-3.5 fill-current" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center', className)}>
      <Button size={size} variant="primary" className="rounded-r-none" onClick={() => void startSync('bookmark', hasData ? 'quick' : 'full')}>
        <RefreshCw /> {hasData ? t('sync.sync') : t('sync.syncBookmarks')}
      </Button>
      <Menu>
        <MenuTrigger asChild>
          <Button size={size} variant="primary" className="rounded-l-none border-l border-white/20 px-2" aria-label={t('sync.moreOptions')}>
            <ChevronDown />
          </Button>
        </MenuTrigger>
        <MenuContent className="w-72">
          <MenuItem onSelect={() => void startSync('bookmark', 'quick')}>
            <Zap />
            <div>
              <div className="font-medium">{t('sync.quick')}</div>
              <div className="text-[11.5px] text-muted">{t('sync.quickDesc')}</div>
            </div>
          </MenuItem>
          <MenuItem onSelect={() => void startSync('bookmark', 'full')} className="h-auto py-2">
            <RefreshCw />
            <div>
              <div className="font-medium">{t('sync.full')}</div>
              <div className="text-[11.5px] text-muted">{t('sync.fullDesc')}</div>
            </div>
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={() => void startSync('like', 'full')} className="h-auto py-2">
            <Heart />
            <div>
              <div className="font-medium">{t('sync.importLikes')}</div>
              <div className="text-[11.5px] text-muted">{t('sync.importLikesDesc')}</div>
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
