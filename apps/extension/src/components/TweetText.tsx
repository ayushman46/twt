import { Fragment, useMemo, type MouseEvent, type ReactNode } from 'react';
import { cn } from './ui/primitives';

const TOKEN_RE = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]'"])|(@\w{1,15})|(#(?=[\p{N}_]*\p{L})[\p{L}\p{N}_]+)|(\$[A-Za-z]{1,6}\b)/gu;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightRegex(terms: string[] | undefined): RegExp | null {
  const t = (terms ?? []).map((x) => x.trim()).filter((x) => x.length > 1);
  if (!t.length) return null;
  return new RegExp(`(${t.map(escapeRe).sort((a, b) => b.length - a.length).join('|')})`, 'giu');
}

export function Highlight({ text, re }: { text: string; re: RegExp | null }) {
  if (!re) return <>{text}</>;
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

function displayUrl(url: string): string {
  const s = url.replace(/^https?:\/\/(www\.)?/, '');
  return s.length > 34 ? s.slice(0, 32) + '…' : s;
}

interface TweetTextProps {
  text: string;
  highlight?: string[];
  className?: string;
  onHashtag?: (tag: string) => void;
  onMention?: (handle: string) => void;
}

export function TweetText({ text, highlight, className, onHashtag, onMention }: TweetTextProps) {
  const re = useMemo(() => highlightRegex(highlight), [highlight]);
  const nodes = useMemo(() => {
    const out: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    let i = 0;
    const stop = (e: MouseEvent) => e.stopPropagation();
    while ((m = TOKEN_RE.exec(text))) {
      if (m.index > last) out.push(<Highlight key={i++} text={text.slice(last, m.index)} re={re} />);
      const [token] = m;
      if (m[1]) {
        out.push(
          <a key={i++} href={token} target="_blank" rel="noreferrer noopener" onClick={stop} className="text-accent hover:underline" title={token}>
            <Highlight text={displayUrl(token)} re={re} />
          </a>,
        );
      } else if (m[2]) {
        const handle = token.slice(1);
        out.push(
          <a
            key={i++}
            href={`https://x.com/${handle}`}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => {
              e.stopPropagation();
              if (onMention) {
                e.preventDefault();
                onMention(handle);
              }
            }}
            className="text-accent hover:underline"
          >
            <Highlight text={token} re={re} />
          </a>,
        );
      } else {
        out.push(
          <button
            key={i++}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHashtag?.(token);
            }}
            className="cursor-pointer text-accent hover:underline"
          >
            <Highlight text={token} re={re} />
          </button>,
        );
      }
      last = m.index + token.length;
    }
    if (last < text.length) out.push(<Highlight key={i++} text={text.slice(last)} re={re} />);
    return out;
  }, [text, re, onHashtag, onMention]);

  return <div className={cn('break-words whitespace-pre-wrap', className)}>{nodes}</div>;
}
