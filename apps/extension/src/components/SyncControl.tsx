import { ChevronDown, Heart, RefreshCw, Square, Zap } from 'lucide-react';
import { toast } from 'sonner';
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
    if (!res.ok) toast.error(res.error ?? 'Could not start sync');
    else toast(`Opening X to sync your ${source === 'like' ? 'likes' : 'bookmarks'}…`, { description: 'Keep that tab open — we’ll scroll through for you.' });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not start sync');
  }
}

export function SyncButton({ className, size = 'sm', hasData }: { className?: string; size?: 'sm' | 'md' | 'lg'; hasData: boolean }) {
  const state = useSyncState();
  const active = isSyncActive(state);

  if (active) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Button size={size} variant="soft" onClick={() => void startSync(state.source, state.mode)}>
          <RefreshCw className="animate-spin" />
          Syncing… {state.found ? fmtNumber(state.found) : ''}
        </Button>
        <Button size={size === 'lg' ? 'icon' : 'icon-sm'} variant="ghost" aria-label="Stop sync" onClick={() => void send('sync/stop', {})}>
          <Square className="!size-3.5 fill-current" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center', className)}>
      <Button size={size} variant="primary" className="rounded-r-none" onClick={() => void startSync('bookmark', hasData ? 'quick' : 'full')}>
        <RefreshCw /> {hasData ? 'Sync' : 'Sync bookmarks'}
      </Button>
      <Menu>
        <MenuTrigger asChild>
          <Button size={size} variant="primary" className="rounded-l-none border-l border-white/20 px-2" aria-label="More sync options">
            <ChevronDown />
          </Button>
        </MenuTrigger>
        <MenuContent className="w-72">
          <MenuItem onSelect={() => void startSync('bookmark', 'quick')}>
            <Zap />
            <div>
              <div className="font-medium">Quick sync</div>
              <div className="text-[11.5px] text-muted">Only new bookmarks — takes seconds</div>
            </div>
          </MenuItem>
          <MenuItem onSelect={() => void startSync('bookmark', 'full')} className="h-auto py-2">
            <RefreshCw />
            <div>
              <div className="font-medium">Full sync</div>
              <div className="text-[11.5px] text-muted">Scroll through every bookmark & refresh stats</div>
            </div>
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={() => void startSync('like', 'full')} className="h-auto py-2">
            <Heart />
            <div>
              <div className="font-medium">Import likes</div>
              <div className="text-[11.5px] text-muted">Add posts you've liked to your library</div>
            </div>
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

export function LastSynced({ className }: { className?: string }) {
  const last = useStorageItem(lastSyncItem, { bookmark: null, like: null });
  const state = useSyncState();
  if (isSyncActive(state)) return <span className={cn('text-[12px] text-muted', className)}>Syncing in an X tab…</span>;
  return <span className={cn('text-[12px] text-muted', className)}>{last.bookmark ? `Synced ${fmtRelative(last.bookmark)}` : 'Not synced yet'}</span>;
}
