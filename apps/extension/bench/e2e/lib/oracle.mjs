/**
 * Independent expectations computed from raw IndexedDB rows, following the
 * documented behaviour (src/lib/query.ts header, route scopes, scan-search).
 * Used to verify what the UI shows — not imported from app code on purpose.
 */

export function scopeFilter(scope, value) {
  switch (scope) {
    case 'all':
      return (b) => !b.archived;
    case 'unread':
      return (b) => !b.archived && !b.read;
    case 'starred':
      return (b) => b.starred === 1;
    case 'archived':
      return (b) => b.archived === 1;
    case 'likes':
      return (b) => !b.archived && (b.sources ?? []).includes('like');
    case 'category':
      return (b) => !b.archived && b.category === value;
    case 'collection':
      return (b) => (b.collections ?? []).includes(value);
    case 'tag':
      return (b) => !b.archived && (b.tags ?? []).includes(value);
    case 'author':
      return (b) => b.author.handle.toLowerCase() === String(value).toLowerCase();
    case 'facet':
      return (b) => !b.archived && (b.facets ?? []).includes(value);
    default:
      throw new Error(`unknown scope ${scope}`);
  }
}

export const countScope = (rows, scope, value) => rows.filter(scopeFilter(scope, value)).length;

/** Text the full-text search scans (scan-search haystack: who, body, extras, note, tags). */
export function haystack(b) {
  const extra = [b.card?.title, b.card?.description, b.article?.title, b.article?.preview, b.summary, ...(b.links ?? []).map((l) => l.display), ...(b.media ?? []).map((m) => m.alt)].filter(Boolean).join(' ');
  return [`${b.author.name} @${b.author.handle}`, b.text, b.quoted?.text ?? '', extra, b.note ?? '', (b.tags ?? []).join(' ')].join('\u0001').toLowerCase();
}

/** Text that "phrases" and -exclusions are checked against (query.ts searchableText). */
export function phraseText(b) {
  return [b.text, b.quoted?.text, b.card?.title, b.card?.description, b.article?.title, b.note, b.summary, b.author.name, b.author.handle, (b.links ?? []).map((l) => l.url).join(' ')]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

/** Single-word free-text match. */
export const textHas = (b, term) => haystack(b).includes(term.toLowerCase());

export const facet = (b, f) => (b.facets ?? []).includes(f);

/**
 * Expected result count for a query built from simple parts.
 * parts: { scope, text, from, cat, tag, has, is, after, before, minLikes, phrase, exclude, notFrom, domain, lang }
 */
export function expectCount(rows, parts) {
  return rows.filter((b) => {
    if (!scopeFilter(parts.scope ?? 'all', parts.scopeValue)(b)) return false;
    if (parts.text && !textHas(b, parts.text)) return false;
    if (parts.from && !b.author.handle.toLowerCase().startsWith(parts.from.toLowerCase())) return false;
    if (parts.notFrom && b.author.handle.toLowerCase() === parts.notFrom.toLowerCase()) return false;
    if (parts.cat && b.category !== parts.cat) return false;
    if (parts.tag && !(b.tags ?? []).some((t) => t === parts.tag || t.startsWith(parts.tag))) return false;
    if (parts.has) {
      const h = parts.has;
      const ok = h === 'note' ? !!b.note?.trim() : h === 'tags' ? (b.tags ?? []).length > 0 : facet(b, h);
      if (!ok) return false;
    }
    if (parts.notHas && facet(b, parts.notHas)) return false;
    if (parts.is) {
      const v = parts.is;
      const ok = v === 'starred' ? b.starred === 1 : v === 'unread' ? b.read === 0 : v === 'read' ? b.read === 1 : v === 'archived' ? b.archived === 1 : facet(b, v);
      if (!ok) return false;
    }
    if (parts.after !== undefined && b.createdAt < parts.after) return false;
    if (parts.before !== undefined && b.createdAt > parts.before) return false;
    if (parts.minLikes !== undefined && b.metrics.likes < parts.minLikes) return false;
    if (parts.lang && b.lang !== parts.lang) return false;
    if (parts.domain) {
      const ds = [...(b.links ?? []).map((l) => l.domain), b.card?.domain ?? ''];
      if (!ds.some((d) => d === parts.domain || d.endsWith('.' + parts.domain) || d.includes(parts.domain))) return false;
    }
    if (parts.phrase && !phraseText(b).includes(parts.phrase.toLowerCase())) return false;
    if (parts.exclude && phraseText(b).includes(parts.exclude.toLowerCase())) return false;
    return true;
  }).length;
}

/** Most common value of fn over rows (ties → first seen). */
export function mostCommon(rows, fn) {
  const m = new Map();
  for (const r of rows) {
    const k = fn(r);
    if (k === undefined || k === null || k === '') continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Minimal RFC 4180 CSV parser (quoted fields, embedded commas/newlines). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

export function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
