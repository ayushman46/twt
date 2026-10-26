import { useMemo } from 'react';
import { toast } from 'sonner';
import { t, useT } from '@/i18n';
import { DEMO_PREFIX, removeDemoData } from '@/lib/demo';
import { useLibrary } from '@/hooks/library';
import { navigate } from '@/hooks/route';
import { startSync } from './SyncControl';
import { Button } from './ui/primitives';

export function DemoBanner() {
  useT();
  const lib = useLibrary();
  const demo = useMemo(() => lib.bookmarks.filter((b) => b.id.startsWith(DEMO_PREFIX)).length, [lib.bookmarks]);
  if (!demo) return null;
  const remove = async () => {
    await removeDemoData();
    toast(t('demo.removed'));
    navigate('#/home');
  };
  return (
    <div data-demo-banner className="flex flex-col gap-2 border-b border-line bg-panel px-5 py-2.5 text-[13px] sm:flex-row sm:items-center sm:gap-4 sm:px-8">
      <p className="min-w-0 text-fg-2 sm:flex-1">
        <span className="font-medium text-fg">{t('demo.title')}</span> <span className="text-muted">{t('demo.body', { count: demo })}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="primary" onClick={() => void startSync('bookmark', 'full')}>
          {t('demo.sync')}
        </Button>
        <Button size="sm" variant="ghost" data-action="remove-demo" onClick={() => void remove()}>
          {t('demo.remove')}
        </Button>
      </div>
    </div>
  );
}
