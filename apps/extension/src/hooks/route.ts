import { useEffect, useState } from 'react';
import type { Scope, ScopeKind } from '@/lib/query';

export type Page = 'home' | 'library' | 'insights' | 'settings' | 'welcome' | 'recall' | 'shelf' | 'ask' | 'wrapped';

export interface Route {
  page: Page;
  scope: Scope;
  section?: string;
  q?: string;
}

const SCOPES_WITH_VALUE: ScopeKind[] = ['category', 'collection', 'tag', 'author', 'facet'];
const SIMPLE_SCOPES: ScopeKind[] = ['all', 'unread', 'starred', 'archived', 'likes'];

export function parseHash(hash: string): Route {
  const [pathPart, queryPart] = hash.replace(/^#/, '').split('?');
  const parts = (pathPart ?? '').split('/').filter(Boolean).map(decodeURIComponent);
  const q = new URLSearchParams(queryPart ?? '').get('q') ?? undefined;
  const page = (parts[0] ?? 'home') as Page;
  if (page === 'library') {
    const kind = (parts[1] ?? 'all') as ScopeKind;
    if (SCOPES_WITH_VALUE.includes(kind) && parts[2]) return { page, scope: { kind, value: parts[2] }, q };
    if (SIMPLE_SCOPES.includes(kind)) return { page, scope: { kind }, q };
    return { page, scope: { kind: 'all' }, q };
  }
  if (page === 'settings') return { page, scope: { kind: 'all' }, section: parts[1] ?? 'general' };
  if (page === 'shelf' || page === 'ask') return { page, scope: { kind: 'all' }, section: parts[1], q };
  if (page === 'insights' || page === 'welcome' || page === 'home' || page === 'recall' || page === 'wrapped') return { page, scope: { kind: 'all' }, section: parts[1] };
  return { page: 'home', scope: { kind: 'all' } };
}

export function scopeHash(scope: Scope): string {
  if (scope.value !== undefined) return `#/library/${scope.kind}/${encodeURIComponent(scope.value)}`;
  return `#/library/${scope.kind}`;
}

export function navigate(hash: string) {
  if (location.hash !== hash) location.hash = hash;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function sameScope(a: Scope, b: Scope): boolean {
  return a.kind === b.kind && (a.value ?? '') === (b.value ?? '');
}
