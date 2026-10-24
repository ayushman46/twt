import { Command } from 'cmdk';
import { Dialog as D } from 'radix-ui';
import { Archive, Brain, ChartColumn, Download, FolderPlus, Gift, Heart, House, Inbox, Keyboard, Layers, Library, MessagesSquare, Moon, RefreshCw, Search, Settings, Sparkles, Star, Sun, Zap } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { catName, useT } from '@/i18n';
import { exportJson, exportMarkdown } from '@/lib/export';
import { fmtShortDate } from '@/lib/format';
import { searchIndex } from '@/lib/scan-search';
import { useLibrary } from '@/hooks/library';
import { navigate, scopeHash } from '@/hooks/route';
import { useSettings } from '@/hooks/data';
import { useUi } from '@/store/ui';
import { Avatar, Logo } from './Brand';
import { startSync } from './SyncControl';
import { Kbd } from './ui/primitives';

function Item({ onSelect, icon, children, hint, value }: { onSelect: () => void; icon: ReactNode; children: ReactNode; hint?: ReactNode; value: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-10 cursor-default items-center gap-3 rounded-xl px-3 text-[13.5px] text-fg-2 data-[selected=true]:bg-panel-2 data-[selected=true]:text-fg [&_svg]:size-4 [&_svg]:text-muted"
    >
      <span className="grid w-5 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint ? <span className="text-[11.5px] text-faint">{hint}</span> : null}
    </Command.Item>
  );
}

const group = 'px-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase';

export function CommandPalette() {
  const t = useT();
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const setQuery = useUi((s) => s.setQuery);
  const openDetail = useUi((s) => s.openDetail);
  const openCollectionDialog = useUi((s) => s.openCollectionDialog);
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen);
  const lib = useLibrary();
  const [settings, update] = useSettings();
  const [value, setValue] = useState('');

  const results = useMemo(() => {
    if (value.trim().length < 2) return [];
    const scores = searchIndex.search(value);
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => lib.byId.get(id))
      .filter((b): b is NonNullable<typeof b> => !!b);
  }, [value, lib.byId]);

  const run = (fn: () => void) => {
    setOpen(false);
    setValue('');
    fn();
  };

  const searchAll = () =>
    run(() => {
      setQuery(value);
      navigate('#/library/all');
    });

  return (
    <D.Root open={open} onOpenChange={(o) => (setOpen(o), o || setValue(''))}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[3px] data-[state=open]:animate-fade-in" />
        <D.Content className="fixed top-[13vh] left-1/2 z-[61] w-[calc(100vw-32px)] max-w-[680px] -translate-x-1/2 animate-rise overflow-hidden rounded-[22px] border border-line bg-panel shadow-pop outline-none">
          <D.Title className="sr-only">{t('palette.title')}</D.Title>
          <D.Description className="sr-only">{t('palette.description')}</D.Description>
          <Command loop shouldFilter={true} filter={(itemValue, search) => (itemValue.startsWith('post:') || itemValue.startsWith('search:') ? 1 : itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-muted" />
              <Command.Input
                value={value}
                onValueChange={setValue}
                placeholder={t('palette.placeholder')}
                className="h-14 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-faint"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[min(60vh,460px)] overflow-y-auto pb-2">
              <Command.Empty className="px-4 py-10 text-center text-sm text-muted">{t('palette.empty')}</Command.Empty>

              {value.trim() ? (
                <Command.Group heading={t('palette.search')} className={group}>
                  <Item value={`search:${value}`} onSelect={searchAll} icon={<Search />} hint="↵">
                    {t('palette.searchAll', { query: value })}
                  </Item>
                </Command.Group>
              ) : null}

              {results.length ? (
                <Command.Group heading={t('palette.bookmarks')} className={group}>
                  {results.map((b) => (
                    <Item key={b.id} value={`post:${b.id}`} onSelect={() => run(() => openDetail(b.id))} icon={<Avatar src={b.author.avatar} name={b.author.name} handle={b.author.handle} size={20} />} hint={fmtShortDate(b.createdAt)}>
                      <span className="font-medium text-fg">@{b.author.handle}</span> <span className="text-muted">— {b.text || b.card?.title || t('common.mediaPost')}</span>
                    </Item>
                  ))}
                </Command.Group>
              ) : null}

              <Command.Group heading={t('palette.goTo')} className={group}>
                <Item value={`home ${t('nav.home')}`} onSelect={() => run(() => navigate('#/home'))} icon={<House />} hint="G H">
                  {t('nav.home')}
                </Item>
                <Item value={`all bookmarks library ${t('nav.all')}`} onSelect={() => run(() => navigate('#/library/all'))} icon={<Layers />} hint="G A">
                  {t('nav.all')}
                </Item>
                <Item value={`unread inbox ${t('nav.unread')}`} onSelect={() => run(() => navigate('#/library/unread'))} icon={<Inbox />} hint="G U">
                  {t('nav.unread')}
                </Item>
                <Item value={`starred favorites ${t('nav.starred')}`} onSelect={() => run(() => navigate('#/library/starred'))} icon={<Star />}>
                  {t('nav.starred')}
                </Item>
                <Item value={`archive ${t('nav.archive')}`} onSelect={() => run(() => navigate('#/library/archived'))} icon={<Archive />}>
                  {t('nav.archive')}
                </Item>
                <Item value={`insights stats analytics ${t('nav.insights')}`} onSelect={() => run(() => navigate('#/insights'))} icon={<ChartColumn />} hint="G I">
                  {t('nav.insights')}
                </Item>
                <Item value={`recall review flashcards memory ${t('nav.recall')}`} onSelect={() => run(() => navigate('#/recall'))} icon={<Brain />}>
                  {t('nav.recall')}
                </Item>
                <Item value={`shelf resources repos papers tools ${t('nav.shelf')}`} onSelect={() => run(() => navigate('#/shelf'))} icon={<Library />}>
                  {t('nav.shelf')}
                </Item>
                <Item value={`ask your bookmarks question chat answers ${t('nav.ask')}`} onSelect={() => run(() => navigate('#/ask'))} icon={<MessagesSquare />}>
                  {t('nav.ask')}
                </Item>
                <Item value={`wrapped year recap ${t('nav.wrapped')}`} onSelect={() => run(() => navigate('#/wrapped'))} icon={<Gift />}>
                  {t('nav.wrapped')}
                </Item>
                <Item value={`settings preferences ${t('nav.settings')}`} onSelect={() => run(() => navigate('#/settings/general'))} icon={<Settings />}>
                  {t('nav.settings')}
                </Item>
              </Command.Group>

              <Command.Group heading={t('sidebar.categories')} className={group}>
                {lib.categories
                  .filter((c) => c.enabled)
                  .map((c) => (
                    <Item key={c.id} value={`category ${c.name} ${catName(c)}`} onSelect={() => run(() => navigate(scopeHash({ kind: 'category', value: c.id })))} icon={<span>{c.emoji}</span>} hint={lib.counts.categories.get(c.id) ?? 0}>
                      {catName(c)}
                    </Item>
                  ))}
              </Command.Group>

              {lib.collections.length ? (
                <Command.Group heading={t('common.collections')} className={group}>
                  {lib.collections.map((c) => (
                    <Item key={c.id} value={`collection ${c.name}`} onSelect={() => run(() => navigate(scopeHash({ kind: 'collection', value: c.id })))} icon={<span>{c.emoji}</span>} hint={lib.counts.collections.get(c.id) ?? 0}>
                      {c.name}
                    </Item>
                  ))}
                </Command.Group>
              ) : null}

              <Command.Group heading={t('palette.actions')} className={group}>
                <Item value={`quick sync bookmarks ${t('palette.quickSync')}`} onSelect={() => run(() => void startSync('bookmark', 'quick'))} icon={<Zap />}>
                  {t('palette.quickSync')}
                </Item>
                <Item value={`full sync bookmarks refresh ${t('palette.fullSync')}`} onSelect={() => run(() => void startSync('bookmark', 'full'))} icon={<RefreshCw />}>
                  {t('palette.fullSync')}
                </Item>
                <Item value={`import likes ${t('palette.importLikes')}`} onSelect={() => run(() => void startSync('like', 'full'))} icon={<Heart />}>
                  {t('palette.importLikes')}
                </Item>
                <Item value={`new collection create ${t('sidebar.newCollection')}`} onSelect={() => run(() => openCollectionDialog())} icon={<FolderPlus />}>
                  {t('sidebar.newCollection')}
                </Item>
                <Item value={`ai categorize settings ${t('palette.aiSettings')}`} onSelect={() => run(() => navigate('#/settings/ai'))} icon={<Sparkles />}>
                  {t('palette.aiSettings')}
                </Item>
                <Item
                  value={`toggle theme dark light mode ${t('palette.toggleDark')}`}
                  onSelect={() => run(() => void update({ theme: document.documentElement.classList.contains('dark') ? 'light' : 'dark' }))}
                  icon={settings.theme === 'dark' ? <Sun /> : <Moon />}
                >
                  {t('palette.toggleDark')}
                </Item>
                <Item value={`export markdown obsidian notion ${t('palette.exportMd')}`} onSelect={() => run(() => void exportMarkdown())} icon={<Download />}>
                  {t('palette.exportMd')}
                </Item>
                <Item value={`export backup json ${t('palette.backup')}`} onSelect={() => run(() => void exportJson())} icon={<Download />}>
                  {t('palette.backup')}
                </Item>
                <Item value={`keyboard shortcuts help ${t('palette.shortcuts')}`} onSelect={() => run(() => setShortcutsOpen(true))} icon={<Keyboard />} hint="?">
                  {t('palette.shortcuts')}
                </Item>
              </Command.Group>
            </Command.List>
            <div className="flex items-center gap-4 border-t border-line bg-panel-2/50 px-4 py-2.5 text-[11.5px] text-faint">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> {t('palette.navigate')}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd> {t('palette.open')}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>esc</Kbd> {t('palette.close')}
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                <Logo className="size-4" /> twtdash
              </span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
