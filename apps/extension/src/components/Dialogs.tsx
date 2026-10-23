import { Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { COLLECTION_COLORS, addToCollection, createCollection, deleteCollection, updateCollection } from '@/lib/actions';
import { OPERATOR_HELP } from '@/lib/query';
import { useLibrary } from '@/hooks/library';
import { navigate, scopeHash } from '@/hooks/route';
import { useUi } from '@/store/ui';
import { Dialog } from './ui/overlays';
import { Button, Input, Kbd, cn } from './ui/primitives';

const EMOJIS = ['📌', '⭐', '📚', '💡', '🧠', '🛠️', '🚀', '🎨', '💻', '🤖', '📈', '💰', '🔥', '❤️', '🎯', '🧪', '🌱', '✍️', '🎬', '🎧', '🍳', '✈️', '🏋️', '🧘', '📝', '🗂️', '🔖', '👀', '🏆', '🧩'];

export function CollectionDialog() {
  const state = useUi((s) => s.collectionDialog);
  const close = useUi((s) => s.closeCollectionDialog);
  const { collectionMap } = useLibrary();
  const editing = state.editId ? collectionMap.get(state.editId) : undefined;
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📌');
  const [color, setColor] = useState(COLLECTION_COLORS[0]!);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!state.open) return;
    setName(editing?.name ?? '');
    setEmoji(editing?.emoji ?? EMOJIS[Math.floor(Math.random() * 8)]!);
    setColor(editing?.color ?? COLLECTION_COLORS[0]!);
    setDescription(editing?.description ?? '');
  }, [state.open, editing]);

  const submit = async () => {
    if (!name.trim()) return;
    if (editing) {
      await updateCollection(editing.id, { name: name.trim(), emoji, color, description });
      toast.success('Collection updated');
    } else {
      const col = await createCollection({ name, emoji, color, description });
      if (state.addIds?.length) {
        await addToCollection(state.addIds, col.id);
        toast.success(`Added to ${col.emoji} ${col.name}`);
      } else {
        navigate(scopeHash({ kind: 'collection', value: col.id }));
      }
    }
    close();
  };

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && close()} title={editing ? 'Edit collection' : 'New collection'} description={editing ? undefined : 'Group posts any way you like — projects, reading lists, inspiration.'}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-line text-lg" style={{ background: `color-mix(in oklab, ${color} 16%, transparent)` }}>
            {emoji}
          </span>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Read later, Design inspo, Startup ideas" maxLength={60} />
        </div>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" maxLength={140} />
        <div>
          <div className="mb-2 text-[12px] font-medium text-muted">Icon</div>
          <div className="grid grid-cols-10 gap-1">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(e)} className={cn('grid aspect-square place-items-center rounded-lg text-[17px] hover:bg-panel-2', emoji === e && 'bg-accent-soft ring-2 ring-accent/40')}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[12px] font-medium text-muted">Color</div>
          <div className="flex flex-wrap gap-2">
            {COLLECTION_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn('size-6 rounded-full ring-offset-2 ring-offset-panel transition-transform hover:scale-110', color === c && 'ring-2 ring-fg/60')}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          {editing ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={async () => {
                await deleteCollection(editing.id);
                toast(`Deleted ${editing.name}`, { description: 'Posts in it were kept.' });
                navigate('#/library/all');
                close();
              }}
            >
              <Trash /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!name.trim()}>
              {editing ? 'Save' : 'Create collection'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

const SHORTCUTS: Array<[string[], string]> = [
  [['⌘/Ctrl', 'K'], 'Command palette'],
  [['/'], 'Search'],
  [['J'], 'Next post'],
  [['K'], 'Previous post'],
  [['↵'], 'Open details'],
  [['O'], 'Open on X'],
  [['S'], 'Star / unstar'],
  [['R'], 'Mark read / unread'],
  [['E'], 'Archive'],
  [['X'], 'Select'],
  [['1–4'], 'Grid · List · Table · Gallery'],
  [['G', 'H'], 'Go home'],
  [['G', 'A'], 'All bookmarks'],
  [['G', 'U'], 'Unread'],
  [['G', 'I'], 'Insights'],
  [['Esc'], 'Close / clear selection'],
  [['?'], 'This help'],
];

export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen);
  const setOpen = useUi((s) => s.setShortcutsOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen} title="Keyboard shortcuts" className="max-w-2xl">
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <div className="space-y-1">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label} className="flex h-8 items-center justify-between text-[13px]">
              <span className="text-fg-2">{label}</span>
              <span className="flex gap-1">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Search operators</div>
          <div className="space-y-1.5">
            {OPERATOR_HELP.map((o) => (
              <div key={o.op} className="text-[12.5px]">
                <code className="rounded bg-panel-2 px-1.5 py-0.5 text-[12px] text-accent">{o.example}</code>
                <span className="ml-2 text-muted">{o.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
