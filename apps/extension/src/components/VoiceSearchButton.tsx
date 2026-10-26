import { Languages, Mic } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger, Tip } from './ui/overlays';
import { cn } from './ui/primitives';

/**
 * Voice input via the Web Speech API (Chrome, Edge, Safari). Renders nothing
 * where it's unsupported (Firefox). Chrome sends the audio to its own speech
 * service, so it needs a connection.
 */

export interface VoiceLanguage {
  code: string;
  name: string;
  native: string;
  /** Tiny label shown next to the mic. */
  short: string;
}

export const VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: 'en-IN', name: 'English (India)', native: 'English', short: 'EN' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी', short: 'हि' },
  { code: 'bn-IN', name: 'Bengali', native: 'বাংলা', short: 'বা' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்', short: 'த' },
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు', short: 'తె' },
  { code: 'mr-IN', name: 'Marathi', native: 'मराठी', short: 'म' },
  { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી', short: 'ગુ' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ', short: 'ಕ' },
  { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം', short: 'മ' },
  { code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', short: 'ਪੰ' },
  { code: 'ur-IN', name: 'Urdu', native: 'اردو', short: 'ار' },
];

const STORAGE_KEY = 'twtdash:voice-lang';

interface RecognitionResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  return recognitionCtor() !== null;
}

function initialLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VOICE_LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    /* storage blocked */
  }
  for (const pref of typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []) {
    const base = pref.toLowerCase().split('-')[0];
    const hit = VOICE_LANGUAGES.find((l) => l.code.startsWith(`${base}-`));
    if (hit) return hit.code;
  }
  return 'en-IN';
}

const blockedHelp = 'Allow the microphone for twtdash: click the icon at the right of the address bar (or open the site settings), then try again.';

/**
 * Ask for the microphone up front. In an extension tab this reliably shows
 * the browser's permission prompt, which speech recognition alone sometimes
 * skips (it then fails with "not-allowed").
 */
async function ensureMicrophone(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    if (status?.state === 'granted') return true;
    if (status?.state === 'denied') {
      toast.error('Microphone access is blocked', { description: blockedHelp });
      return false;
    }
  } catch {
    /* permissions API without "microphone": just try */
  }
  if (!navigator.mediaDevices?.getUserMedia) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return true;
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      toast.error('Microphone access is blocked', { description: blockedHelp });
      return false;
    }
    if (name === 'NotFoundError') {
      toast.error('No microphone found', { description: 'Connect a microphone, or check your system’s sound settings.' });
      return false;
    }
    return true; // let speech recognition report anything else
  }
}

function reportError(error: string, language: VoiceLanguage) {
  switch (error) {
    case 'aborted':
      return;
    case 'no-speech':
      toast('Didn’t catch that', { description: `Nothing was heard. Check your mic and try again, speaking in ${language.name}.` });
      return;
    case 'not-allowed':
      toast.error('Microphone access is blocked', { description: blockedHelp });
      return;
    case 'service-not-allowed':
      toast.error('Voice input isn’t available here', { description: 'This browser’s speech service is turned off. Voice input works in Chrome and Edge.' });
      return;
    case 'audio-capture':
      toast.error('No microphone found', { description: 'Connect a microphone, or check your system’s sound settings.' });
      return;
    case 'network':
      toast.error('Voice input needs an internet connection', { description: 'Your browser’s speech service couldn’t be reached. Check your connection and try again.' });
      return;
    case 'language-not-supported':
      toast.error(`${language.name} isn’t supported for voice input in this browser`, { description: 'Pick another language from the menu next to the mic.' });
      return;
    default:
      toast.error('Voice input stopped', { description: 'Something went wrong with speech recognition. Try again.' });
  }
}

export interface VoiceSearchButtonProps {
  /** Called with the transcript so far; `isFinal` once the browser has settled on it. */
  onResult: (text: string, isFinal: boolean) => void;
  /** BCP-47 code (e.g. "hi-IN"); otherwise the last choice, then the browser language. */
  lang?: string;
  onListeningChange?: (listening: boolean) => void;
  className?: string;
  disabled?: boolean;
  /** What the mic is for, used in the tooltip and aria text (e.g. "Speak your search", "Speak your question"). */
  purpose?: string;
}

export function VoiceSearchButton({ onResult, lang, onListeningChange, className, disabled, purpose = 'Speak' }: VoiceSearchButtonProps) {
  const Recognition = useMemo(recognitionCtor, []);
  const [picked, setPicked] = useState(initialLanguage);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const recRef = useRef<RecognitionLike | null>(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const listeningRef = useRef(onListeningChange);
  listeningRef.current = onListeningChange;

  const code = lang && VOICE_LANGUAGES.some((l) => l.code === lang) ? lang : picked;
  const language = VOICE_LANGUAGES.find((l) => l.code === code) ?? VOICE_LANGUAGES[0]!;

  useEffect(() => () => recRef.current?.abort(), []);
  useEffect(() => {
    listeningRef.current?.(listening);
  }, [listening]);

  if (!Recognition) return null;

  const choose = (next: string) => {
    setPicked(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    // Switching language mid-utterance: restart in the new language.
    if (recRef.current) recRef.current.abort();
  };

  const start = async () => {
    if (recRef.current || starting) return;
    setStarting(true);
    const ok = await ensureMicrophone();
    setStarting(false);
    if (!ok) return;
    const rec = new Recognition();
    rec.lang = language.code;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i]![0].transcript;
      const last = e.results[e.results.length - 1];
      resultRef.current(text.replace(/\s+/g, ' ').trim(), !!last?.isFinal);
    };
    rec.onerror = (e) => reportError(e.error, language);
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      toast.error('Couldn’t start voice input', { description: 'Another tab may be using the microphone. Try again.' });
    }
  };

  const stop = () => recRef.current?.stop();

  return (
    <div className={cn('inline-flex items-center gap-0.5', className)}>
      <Tip label={listening ? 'Stop listening' : `${purpose} · ${language.native}`}>
        <button
          type="button"
          onClick={() => (listening ? stop() : void start())}
          disabled={disabled || starting}
          aria-pressed={listening}
          aria-label={listening ? 'Stop voice input' : `Voice input in ${language.name}`}
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
            listening ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-panel-2 hover:text-fg active:bg-panel-3',
          )}
        >
          {listening ? <Mic strokeWidth={1.75} className="animate-pulse" /> : <Mic strokeWidth={1.75} />}
        </button>
      </Tip>
      <Menu>
        <Tip label={`Voice language: ${language.name}`}>
          <MenuTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Voice language: ${language.name}`}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-[background-color,color,transform] duration-150 ease-out hover:bg-panel-2 hover:text-fg active:scale-[0.96] active:bg-panel-3 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-panel-2 data-[state=open]:text-fg"
            >
              <Languages className="size-4" strokeWidth={1.75} />
            </button>
          </MenuTrigger>
        </Tip>
        <MenuContent align="start" className="w-60">
          <MenuLabel>Voice language</MenuLabel>
          <MenuRadioGroup value={code} onValueChange={choose}>
            {VOICE_LANGUAGES.map((l) => (
              <MenuRadioItem key={l.code} value={l.code}>
                <span className="font-medium" lang={l.code}>
                  {l.native}
                </span>
                {l.native !== l.name ? <span className="text-[12px] text-faint">{l.name}</span> : null}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuContent>
      </Menu>
    </div>
  );
}
