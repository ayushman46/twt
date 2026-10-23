import { FlaskConical, X } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { DEMO_PREFIX, removeDemoData } from '@/lib/demo';
import { useLibrary } from '@/hooks/library';
import { navigate } from '@/hooks/route';
import { startSync } from './SyncControl';
import { Button } from './ui/primitives';

export function DemoBanner() {
  const lib = useLibrary();
  const demo = useMemo(() => lib.bookmarks.filter((b) => b.id.startsWith(DEMO_PREFIX)).length, [lib.bookmarks]);
  if (!demo) return null;
  const remove = async () => {
    await removeDemoData();
    toast('Sample data removed');
    navigate('#/home');
  };
  return (
    <div className="relative flex flex-wrap items-center gap-3 overflow-hidden border-b border-line px-5 py-2.5 text-[13px] sm:px-8">
      <span aria-hidden className="aurora absolute inset-0" />
      <FlaskConical className="relative size-4 text-accent" />
      <span className="relative min-w-0 flex-1">
        <b className="font-semibold">You’re exploring sample data.</b> <span className="text-muted">{demo} fictional posts — sync your real bookmarks when you’re ready.</span>
      </span>
      <Button size="xs" variant="primary" className="relative" onClick={() => void startSync('bookmark', 'full')}>
        Sync my bookmarks
      </Button>
      <Button size="xs" variant="ghost" className="relative" onClick={() => void remove()}>
        <X /> Remove sample data
      </Button>
    </div>
  );
}
