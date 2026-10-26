import { TRANSLATE_LANGUAGES, type TranslateLanguageCode } from '@twtdash/shared';
import { ArrowRight, Check, ChevronDown, Copy, KeyRound, Languages, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { aiReady, AiError } from '@/lib/ai-config';
import {
  browserLanguage,
  defaultTranslateTarget,
  ensureNvidiaAccess,
  getCachedTranslation,
  postLanguage,
  setCachedTranslation,
  translateText,
  translationKey,
} from '@/lib/ask';
import { useSettings } from '@/hooks/data';
import { navigate } from '@/hooks/route';
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger, Popover, PopoverAnchor, PopoverContent, Tip } from './ui/overlays';
import { Button, cn } from './ui/primitives';

const STORAGE_KEY = 'twtdash:translate-lang';

function remembered(): TranslateLanguageCode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return TRANSLATE_LANGUAGES.some((l) => l.code === v) ? (v as TranslateLanguageCode) : null;
  } catch {
    return null;
  }
}

function remember(code: TranslateLanguageCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

const langOf = (code: TranslateLanguageCode) => TRANSLATE_LANGUAGES.find((l) => l.code === code)!;

type State = { status: 'idle' } | { status: 'loading'; target: TranslateLanguageCode } | { status: 'done'; target: TranslateLanguageCode; text: string };

/**
 * Translate a post into English or an Indian language with the user's AI
 * (free NVIDIA key or Pro). Results are cached for the session.
 */
export function TranslateButton({ text, postId, className }: { text: string; postId: string; className?: string }) {
  const [settings] = useSettings();
  const ready = aiReady(settings);
  const [target, setTarget] = useState<TranslateLanguageCode>(() => defaultTranslateTarget(text, remembered(), browserLanguage()));
  const [state, setState] = useState<State>({ status: 'idle' });
  const [shown, setShown] = useState(false);
  const [ctaOpen, setCtaOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // A different post: start fresh (and drop any request still in flight).
  useEffect(() => {
    setTarget(defaultTranslateTarget(text, remembered(), browserLanguage()));
    setState({ status: 'idle' });
    setShown(false);
    return () => abortRef.current?.abort();
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!text.trim()) return null;

  const run = (to: TranslateLanguageCode) => {
    if (!ready) {
      setCtaOpen(true);
      return;
    }
    const key = translationKey(postId, to, text);
    const cached = getCachedTranslation(key);
    if (cached) {
      setState({ status: 'done', target: to, text: cached });
      setShown(true);
      return;
    }
    // Starts the permission prompt (if any) while we're still inside the click.
    const access = ensureNvidiaAccess(settings);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: 'loading', target: to });
    void (async () => {
      try {
        await access;
        const out = await translateText(text, to, settings, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setCachedTranslation(key, out);
        setState({ status: 'done', target: to, text: out });
        setShown(true);
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({ status: 'idle' });
        const code = err instanceof AiError ? err.code : undefined;
        toast.error(err instanceof Error ? err.message : 'Translation failed', {
          action: code === 'auth' || code === 'config' || code === 'license' ? { label: 'Settings', onClick: () => navigate(code === 'license' ? '#/settings/plan' : '#/settings/ai') } : undefined,
        });
      }
    })();
  };

  const pick = (code: string) => {
    const to = code as TranslateLanguageCode;
    setTarget(to);
    remember(to);
    run(to);
  };

  const onMain = () => {
    if (state.status === 'loading') return;
    if (state.status === 'done' && state.target === target) {
      setShown((v) => !v);
      return;
    }
    run(target);
  };

  const source = postLanguage(text);
  const loading = state.status === 'loading';
  const done = state.status === 'done' ? state : null;
  const lang = langOf(done?.target ?? target);
  const mainLabel = loading ? 'Translating…' : done && done.target === target ? (shown ? 'Show original' : 'Show translation') : `Translate to ${langOf(target).native}`;

  const copy = async () => {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Couldn’t copy to the clipboard');
    }
  };

  const control = (
    <div className="inline-flex max-w-full items-stretch overflow-hidden rounded-lg border border-line bg-panel">
      <button
        type="button"
        onClick={onMain}
        aria-busy={loading}
        className="group/tr inline-flex min-h-8 min-w-0 items-center gap-1.5 py-1 pr-2.5 pl-2.5 text-left text-[12.5px] font-medium text-fg-2 transition-colors duration-150 hover:bg-panel-2 hover:text-fg active:bg-panel-3 [&_svg]:size-3.5 [&_svg]:shrink-0"
      >
        {loading ? <LoaderCircle className="animate-spin text-muted" strokeWidth={1.75} /> : <Languages className="text-muted transition-colors group-hover/tr:text-fg" strokeWidth={1.75} />}
        <span className="min-w-0 truncate">{mainLabel}</span>
      </button>
      <Menu>
        <Tip label="Choose language">
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="Choose translation language"
              className="inline-flex min-h-8 shrink-0 items-center border-l border-line px-2 text-muted transition-colors duration-150 hover:bg-panel-2 hover:text-fg active:bg-panel-3"
            >
              <ChevronDown className="size-3.5" strokeWidth={1.75} />
            </button>
          </MenuTrigger>
        </Tip>
        <MenuContent align="start" className="w-60">
          <MenuLabel>Translate to</MenuLabel>
          <MenuRadioGroup value={target} onValueChange={pick}>
            {TRANSLATE_LANGUAGES.filter((l) => l.code !== source).map((l) => (
              <MenuRadioItem key={l.code} value={l.code}>
                <span className="font-medium" lang={l.code === 'hinglish' ? 'hi-Latn' : l.code}>
                  {l.native}
                </span>
                {l.native !== l.name ? <span className="text-[12px] text-faint">{l.name}</span> : <span className="text-[12px] text-faint">{l.code === 'hinglish' ? 'Roman Hindi' : ''}</span>}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuContent>
      </Menu>
    </div>
  );

  return (
    <div className={cn('min-w-0', className)}>
      {ready ? (
        control
      ) : (
        <Popover open={ctaOpen} onOpenChange={setCtaOpen}>
          <PopoverAnchor asChild>
            <div className="inline-flex">{control}</div>
          </PopoverAnchor>
          <PopoverContent className="w-[min(300px,calc(100vw-24px))] p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
              <KeyRound className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
              Translate with a free NVIDIA key
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Read any post in हिन्दी, தமிழ், বাংলা and 9 more languages. The key is free and stays in this browser.
            </p>
            <Button
              size="sm"
              variant="primary"
              className="mt-3 w-full"
              onClick={() => {
                setCtaOpen(false);
                navigate('#/settings/ai');
              }}
            >
              Add a free key <ArrowRight strokeWidth={1.75} />
            </Button>
          </PopoverContent>
        </Popover>
      )}

      {done && shown ? (
        <div className="mt-3 animate-fade-in rounded-xl border border-line bg-panel p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[12px] text-muted">
            <Languages className="size-3.5 shrink-0" strokeWidth={1.75} />
            <span className="min-w-0">
              Translated to <span lang={lang.code === 'hinglish' ? 'hi-Latn' : lang.code}>{lang.native}</span> by AI
            </span>
          </div>
          <p lang={lang.code === 'hinglish' ? 'hi-Latn' : lang.code} dir={lang.rtl ? 'rtl' : 'auto'} className="text-[15px] leading-[1.7] whitespace-pre-wrap text-fg">
            {done.text}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1 [&_svg]:stroke-[1.75]">
            <Button size="xs" variant="ghost" onClick={() => setShown(false)}>
              Show original
            </Button>
            <Button size="xs" variant="ghost" onClick={() => void copy()}>
              {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
            </Button>
            <span className="ml-auto text-[11.5px] text-faint">May contain mistakes</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
