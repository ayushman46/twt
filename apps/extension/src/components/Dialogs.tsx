import { Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { t, tOr, useT, type ExtraKey, type MessageKey } from '@/i18n';
import { COLLECTION_COLORS, addToCollection, createCollection, deleteCollection, updateCollection } from '@/lib/actions';
import { OPERATOR_HELP } from '@/lib/query';
import { useLibrary } from '@/hooks/library';
import { navigate, scopeHash } from '@/hooks/route';
import { useUi } from '@/store/ui';
import { Dialog } from './ui/overlays';
import { Button, Input, Kbd, cn } from './ui/primitives';

const EMOJIS = ['📌', '⭐', '📚', '💡', '🧠', '🛠️', '🚀', '🎨', '💻', '🤖', '📈', '💰', '🔥', '❤️', '🎯', '🧪', '🌱', '✍️', '🎬', '🎧', '🍳', '✈️', '🏋️', '🧘', '📝', '🗂️', '🔖', '👀', '🏆', '🧩'];

const FIELD_LABEL = 'mb-2 text-[12.5px] font-medium text-muted';

export function CollectionDialog() {
  useT();
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
      toast.success(t('collection.updated'));
    } else {
      const col = await createCollection({ name, emoji, color, description });
      if (state.addIds?.length) {
        await addToCollection(state.addIds, col.id);
        toast.success(t('menu.addedTo', { name: `${col.emoji} ${col.name}` }));
      } else {
        navigate(scopeHash({ kind: 'collection', value: col.id }));
      }
    }
    close();
  };

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && close()} title={editing ? t('collection.edit') : t('collection.new')} description={editing ? undefined : t('collection.desc')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-5"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-lg" style={{ background: `color-mix(in oklab, ${color} 16%, transparent)` }}>
            {emoji}
          </span>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('collection.namePlaceholder')} maxLength={60} />
        </div>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('collection.descPlaceholder')} maxLength={140} />
        <div>
          <div className={FIELD_LABEL}>{t('collection.icon')}</div>
          <div className="grid grid-cols-10 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cn('grid aspect-square place-items-center rounded-lg text-[17px] transition-colors hover:bg-panel-2', emoji === e && 'bg-accent-soft ring-1 ring-accent/60')}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className={FIELD_LABEL}>{t('collection.color')}</div>
          <div className="flex flex-wrap gap-2">
            {COLLECTION_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn('size-6 rounded-full ring-offset-2 ring-offset-panel transition-transform hover:scale-110', color === c && 'ring-2 ring-fg/60')}
                style={{ background: c }}
                aria-label={t('collection.colorLabel', { color: c })}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4">
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2.5 hover:text-bad"
              onClick={async () => {
                await deleteCollection(editing.id);
                toast(t('collection.deleted', { name: editing.name }), { description: t('collection.deletedDesc') });
                navigate('#/library/all');
                close();
              }}
            >
              <Trash /> {t('common.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={!name.trim()}>
              {editing ? t('common.save') : t('collection.create')}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

const SHORTCUTS: Array<[string[], MessageKey]> = [
  [['⌘/Ctrl', 'K'], 'shortcuts.palette'],
  [['/'], 'shortcuts.search'],
  [['J'], 'shortcuts.next'],
  [['K'], 'shortcuts.prev'],
  [['↵'], 'shortcuts.open'],
  [['O'], 'shortcuts.openX'],
  [['S'], 'shortcuts.star'],
  [['R'], 'shortcuts.read'],
  [['E'], 'shortcuts.archive'],
  [['X'], 'shortcuts.select'],
  [['1–4'], 'shortcuts.layouts'],
  [['G', 'H'], 'shortcuts.home'],
  [['G', 'A'], 'shortcuts.all'],
  [['G', 'U'], 'shortcuts.unread'],
  [['G', 'I'], 'shortcuts.insights'],
  [['Esc'], 'shortcuts.esc'],
  [['?'], 'shortcuts.help'],
];

export function ShortcutsDialog() {
  useT();
  const open = useUi((s) => s.shortcutsOpen);
  const setOpen = useUi((s) => s.setShortcutsOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen} title={t('shortcuts.title')} className="max-w-2xl">
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <div>
          <table className="w-full border-collapse text-[13px]">
            <tbody className="divide-y divide-line">
              {SHORTCUTS.map(([keys, label]) => (
                <tr key={label}>
                  <th scope="row" className="h-9 py-0 pr-3 text-left font-normal text-fg-2">
                    {t(label)}
                  </th>
                  <td className="h-9 py-0 text-right">
                    <span className="inline-flex justify-end gap-1">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className={FIELD_LABEL}>{t('shortcuts.operators')}</div>
          <table className="w-full border-collapse text-[12.5px]">
            <tbody className="divide-y divide-line">
              {OPERATOR_HELP.map((o) => (
                <tr key={o.op}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal align-top">
                    <code className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[12px] text-fg-2">{o.example}</code>
                  </th>
                  <td className="py-2 text-muted">{tOr(`op.${o.op}` as ExtraKey, o.description)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}
