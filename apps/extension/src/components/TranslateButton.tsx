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
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger, Popover, PopoverAnchor, PopoverContent } from './ui/overlays';
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
    <div className="inline-flex items-center rounded-full border border-line bg-panel shadow-card">
      <button
        type="button"
        onClick={onMain}
        aria-busy={loading}
        className="inline-flex h-8 items-center gap-1.5 rounded-l-full pr-2 pl-3 text-[12.5px] font-medium text-fg-2 transition-colors hover:bg-panel-2 hover:text-fg [&_svg]:size-3.5"
      >
        {loading ? <LoaderCircle className="animate-spin text-accent" /> : <Languages className="text-accent" />}
        <span>{mainLabel}</span>
      </button>
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="Choose translation language"
            className="inline-flex h-8 items-center rounded-r-full border-l border-line pr-2.5 pl-1.5 text-muted transition-colors hover:bg-panel-2 hover:text-fg"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </MenuTrigger>
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
          <PopoverContent className="w-[300px] p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
              <span className="grid size-7 place-items-center rounded-lg bg-accent-soft text-accent">
                <KeyRound className="size-3.5" />
              </span>
              Translate with a free NVIDIA key
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
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
              Add a free key <ArrowRight />
            </Button>
          </PopoverContent>
        </Popover>
      )}

      {done && shown ? (
        <div className="mt-3 animate-rise rounded-2xl border border-line bg-panel-2/50 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
            <Languages className="size-3.5 text-accent" />
            <span>
              Translated to <span className="normal-case">{lang.native}</span> by AI
            </span>
          </div>
          <p lang={lang.code === 'hinglish' ? 'hi-Latn' : lang.code} dir={lang.rtl ? 'rtl' : 'auto'} className="text-[15.5px] leading-[1.7] whitespace-pre-wrap text-fg">
            {done.text}
          </p>
          <div className="mt-3 flex items-center gap-1">
            <Button size="xs" variant="ghost" onClick={() => setShown(false)}>
              Show original
            </Button>
            <Button size="xs" variant="ghost" onClick={() => void copy()}>
              {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
            </Button>
            <span className="ml-auto text-[11px] text-faint">May contain mistakes</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
