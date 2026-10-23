import { Archive, Circle, CircleCheck, Download, FolderPlus, Layers, Sparkles, Star, Tag, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { addTags, setArchived, setRead, setStarred } from '@/lib/actions';
import { exportCsv, exportJson, exportMarkdown } from '@/lib/export';
import { fmtNumber } from '@/lib/format';
import type { Bookmark } from '@/lib/types';
import { useUi } from '@/store/ui';
import { CategoryMenuItems, CollectionMenuItems, deleteWithUndo } from './BookmarkMenu';
import { Menu, MenuContent, MenuItem, MenuTrigger, Popover, PopoverContent, PopoverTrigger, Tip } from './ui/overlays';
import { Button, Input } from './ui/primitives';

export function BulkBar({ items, onAi, aiAvailable }: { items: Bookmark[]; onAi: (ids: string[]) => void; aiAvailable: boolean }) {
  const selection = useUi((s) => s.selection);
  const setSelection = useUi((s) => s.setSelection);
  const clear = useUi((s) => s.clearSelection);
  const [tag, setTag] = useState('');
  const ids = [...selection];
  const n = ids.length;
  const selected = items.filter((b) => selection.has(b.id));
  const allStarred = selected.length > 0 && selected.every((b) => b.starred);
  const allRead = selected.length > 0 && selected.every((b) => b.read);

  return (
    <>
      {n > 0 ? (
        <div className="fixed bottom-5 left-1/2 z-30 max-w-[calc(100vw-24px)] -translate-x-1/2">
        <div className="flex animate-rise items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-panel/95 p-1.5 shadow-pop backdrop-blur-xl">
          <span className="px-2.5 text-[13px] font-semibold whitespace-nowrap tabular-nums">{fmtNumber(n)} selected</span>
          {n < items.length ? (
            <Button size="sm" variant="ghost" onClick={() => setSelection(items.map((b) => b.id))}>
              Select all {fmtNumber(items.length)}
            </Button>
          ) : null}
          <span className="mx-1 h-5 w-px bg-line" />
          <Tip label={allStarred ? 'Unstar' : 'Star'}>
            <Button size="icon-sm" variant="ghost" onClick={() => void setStarred(ids, !allStarred)} aria-label="Star">
              <Star className={allStarred ? 'fill-amber-400 text-amber-400' : ''} />
            </Button>
          </Tip>
          <Tip label={allRead ? 'Mark unread' : 'Mark read'}>
            <Button size="icon-sm" variant="ghost" onClick={() => void setRead(ids, !allRead)} aria-label="Toggle read">
              {allRead ? <Circle /> : <CircleCheck />}
            </Button>
          </Tip>
          <Tip label="Archive">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Archive"
              onClick={() => {
                void setArchived(ids, true);
                toast.success(`Archived ${fmtNumber(n)} posts`, { action: { label: 'Undo', onClick: () => void setArchived(ids, false) } });
                clear();
              }}
            >
              <Archive />
            </Button>
          </Tip>
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <Layers /> Category
              </Button>
            </MenuTrigger>
            <MenuContent side="top" align="center" className="w-56">
              <CategoryMenuItems ids={ids} />
            </MenuContent>
          </Menu>
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <FolderPlus /> Collection
              </Button>
            </MenuTrigger>
            <MenuContent side="top" align="center" className="w-56">
              <CollectionMenuItems ids={ids} />
            </MenuContent>
          </Menu>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost">
                <Tag /> Tag
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="w-64">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!tag.trim()) return;
                  void addTags(ids, tag.split(','));
                  toast.success(`Tagged ${fmtNumber(n)} posts`);
                  setTag('');
                }}
                className="flex gap-2"
              >
                <Input autoFocus value={tag} onChange={(e) => setTag(e.target.value)} placeholder="react, must-read" onKeyDown={(e) => e.stopPropagation()} />
                <Button type="submit" variant="primary">
                  Add
                </Button>
              </form>
            </PopoverContent>
          </Popover>
          {aiAvailable ? (
            <Tip label="Re-run AI on selection">
              <Button size="icon-sm" variant="ghost" onClick={() => onAi(ids)} aria-label="AI categorize">
                <Sparkles />
              </Button>
            </Tip>
          ) : null}
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="Export selection">
                <Download />
              </Button>
            </MenuTrigger>
            <MenuContent side="top" align="center">
              <MenuItem onSelect={() => void exportMarkdown(selected)}>Markdown (.md)</MenuItem>
              <MenuItem onSelect={() => void exportCsv(selected)}>Spreadsheet (.csv)</MenuItem>
              <MenuItem onSelect={() => void exportJson(selected)}>Backup (.json)</MenuItem>
            </MenuContent>
          </Menu>
          <Tip label="Remove from twtdash">
            <Button
              size="icon-sm"
              variant="ghost"
              className="hover:text-bad"
              aria-label="Delete"
              onClick={() => {
                void deleteWithUndo(ids);
                clear();
              }}
            >
              <Trash />
            </Button>
          </Tip>
          <span className="mx-1 h-5 w-px bg-line" />
          <Tip label="Clear selection" shortcut="Esc">
            <Button size="icon-sm" variant="ghost" onClick={clear} aria-label="Clear selection">
              <X />
            </Button>
          </Tip>
        </div>
        </div>
      ) : null}
    </>
  );
}
