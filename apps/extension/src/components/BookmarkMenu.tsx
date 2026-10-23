import { Archive, ArchiveRestore, Check, Circle, Copy, ExternalLink, FolderPlus, Layers, PanelRight, Plus, Star, Trash } from 'lucide-react';
import { cloneElement, useState, type KeyboardEvent, type ReactElement, type SyntheticEvent } from 'react';
import { toast } from 'sonner';
import { addToCollection, deleteBookmarks, removeFromCollection, restoreBookmarks, setArchived, setCategory, setRead, setStarred } from '@/lib/actions';
import type { Bookmark } from '@/lib/types';
import { useLibrary } from '@/hooks/library';
import { useUi } from '@/store/ui';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from './ui/overlays';

export async function copyText(text: string, label = 'Link copied') {
  await navigator.clipboard.writeText(text);
  toast.success(label);
}

export async function deleteWithUndo(ids: string[]) {
  const removed = await deleteBookmarks(ids);
  toast(`Removed ${removed.length === 1 ? 'post' : `${removed.length} posts`} from twtdash`, {
    description: 'It stays bookmarked on X.',
    action: { label: 'Undo', onClick: () => void restoreBookmarks(removed) },
  });
}

export function CategoryMenuItems({ ids, current }: { ids: string[]; current?: string }) {
  const { categories } = useLibrary();
  return (
    <>
      {categories
        .filter((c) => c.enabled)
        .map((c) => (
          <MenuItem
            key={c.id}
            onSelect={() => {
              void setCategory(ids, c.id);
              toast.success(`Moved to ${c.emoji} ${c.name}`);
            }}
          >
            <span className="w-4 text-center">{c.emoji}</span>
            <span className="truncate">{c.name}</span>
            {current === c.id ? <Check className="ml-auto !text-accent" /> : null}
          </MenuItem>
        ))}
    </>
  );
}

export function CollectionMenuItems({ ids, current = [] }: { ids: string[]; current?: string[] }) {
  const { collections } = useLibrary();
  const openCollectionDialog = useUi((s) => s.openCollectionDialog);
  return (
    <>
      {collections.map((c) => {
        const inIt = current.includes(c.id);
        return (
          <MenuItem
            key={c.id}
            onSelect={() => {
              if (inIt) void removeFromCollection(ids, c.id);
              else {
                void addToCollection(ids, c.id);
                toast.success(`Added to ${c.emoji} ${c.name}`);
              }
            }}
          >
            <span className="w-4 text-center">{c.emoji}</span>
            <span className="truncate">{c.name}</span>
            {inIt ? <Check className="ml-auto !text-accent" /> : null}
          </MenuItem>
        );
      })}
      {collections.length ? <MenuSeparator /> : null}
      <MenuItem onSelect={() => openCollectionDialog({ addIds: ids })}>
        <Plus /> New collection…
      </MenuItem>
    </>
  );
}

type TriggerProps = { onPointerDown?: (e: SyntheticEvent) => void; onKeyDown?: (e: KeyboardEvent<Element>) => void };

export function BookmarkMenu({ b, children, align = 'end' }: { b: Bookmark; children: ReactElement<TriggerProps>; align?: 'start' | 'end' }) {
  const openDetail = useUi((s) => s.openDetail);
  // The Radix menu is mounted on first interaction, so idle cards stay cheap to render.
  const [armed, setArmed] = useState(false);
  const ids = [b.id];
  if (!armed) {
    return cloneElement(children, {
      onPointerDown: (e: SyntheticEvent) => {
        children.props.onPointerDown?.(e);
        setArmed(true);
      },
      onKeyDown: (e: KeyboardEvent<Element>) => {
        children.props.onKeyDown?.(e);
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setArmed(true);
        }
      },
    });
  }
  return (
    <Menu modal={false} defaultOpen>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align={align} onClick={(e) => e.stopPropagation()} className="w-56">
        <MenuItem onSelect={() => openDetail(b.id)} shortcut="↵">
          <PanelRight /> Open details
        </MenuItem>
        <MenuItem onSelect={() => window.open(b.url, '_blank', 'noopener')} shortcut="O">
          <ExternalLink /> Open on X
        </MenuItem>
        <MenuItem onSelect={() => void copyText(b.url)}>
          <Copy /> Copy link
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => void setStarred(ids, !b.starred)} shortcut="S">
          <Star className={b.starred ? '!fill-amber-400 !text-amber-400' : ''} /> {b.starred ? 'Unstar' : 'Star'}
        </MenuItem>
        <MenuItem onSelect={() => void setRead(ids, !b.read)} shortcut="R">
          <Circle className={!b.read ? '!fill-accent !text-accent' : ''} /> Mark as {b.read ? 'unread' : 'read'}
        </MenuItem>
        <MenuItem onSelect={() => void setArchived(ids, !b.archived)} shortcut="E">
          {b.archived ? <ArchiveRestore /> : <Archive />} {b.archived ? 'Unarchive' : 'Archive'}
        </MenuItem>
        <MenuSeparator />
        <MenuSub>
          <MenuSubTrigger>
            <Layers /> Category
          </MenuSubTrigger>
          <MenuSubContent className="w-56">
            <CategoryMenuItems ids={ids} current={b.category} />
          </MenuSubContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger>
            <FolderPlus /> Collections
          </MenuSubTrigger>
          <MenuSubContent className="w-56">
            <CollectionMenuItems ids={ids} current={b.collections} />
          </MenuSubContent>
        </MenuSub>
        <MenuSeparator />
        <MenuItem danger onSelect={() => void deleteWithUndo(ids)}>
          <Trash /> Remove from twtdash
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
