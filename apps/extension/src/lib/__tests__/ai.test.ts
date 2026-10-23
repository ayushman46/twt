import 'fake-indexeddb/auto';
import {
  AiCallError,
  buildCategorizeRequest,
  DEFAULT_AI_MODEL,
  extractJson,
  NVIDIA_API_BASE,
  parseCategorizeOutput,
  requestCategorization,
  type AiCategoryInput,
  type AiTweetInput,
} from '@twtdash/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiError } from '../ai-config';
import { testApiKey } from '../ai';
import { mergeSettings } from '../storage';

const categories: AiCategoryInput[] = [
  { id: 'ai', name: 'AI & ML', description: 'AI' },
  { id: 'dev', name: 'Programming', description: 'Code' },
  { id: 'other', name: 'Other', description: 'Anything else' },
];
const tweets: AiTweetInput[] = [
  { id: '1', author: '@a (A)', text: 'Prompting tips for agents' },
  { id: '2', author: '@b (B)', text: 'React state colocation' },
];
const good = JSON.stringify({
  results: [
    { id: '1', category: 'ai', tags: ['#Prompting', 'agents'], summary: 'Tips.' },
    { id: '2', category: 'dev', tags: ['react'], summary: '' },
  ],
});

function completion(content: string, finish_reason = 'stop') {
  return new Response(JSON.stringify({ model: 'm', choices: [{ finish_reason, message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('extractJson', () => {
  it('reads plain, fenced, prose-wrapped and reasoning-prefixed replies', () => {
    expect(extractJson(good)).toHaveProperty('results');
    expect(extractJson('```json\n' + good + '\n```')).toHaveProperty('results');
    expect(extractJson('Here you go:\n' + good + '\nHope that helps!')).toHaveProperty('results');
    expect(extractJson('<think>post 1 is about AI…</think>\n' + good)).toHaveProperty('results');
    expect(extractJson('[{"id":"1"}]')).toEqual([{ id: '1' }]);
  });

  it('rejects replies with no JSON or an unfinished reasoning block', () => {
    expect(() => extractJson('Sorry, I cannot help with that.')).toThrow();
    expect(() => extractJson('<think>still thinking about post 1')).toThrow(/no answer/);
  });
});

describe('parseCategorizeOutput', () => {
  it('keeps valid rows, cleans tags and drops unknown ids or categories', () => {
    const text = JSON.stringify({
      results: [
        { id: '1', category: ' AI ', tags: ['#Prompting', 'prompting', 'x'], summary: '  Tips.  ' },
        { id: '1', category: 'dev', tags: [], summary: '' },
        { id: '9', category: 'ai', tags: [], summary: '' },
        { id: '2', category: 'crypto', tags: [], summary: '' },
      ],
    });
    expect(parseCategorizeOutput(text, ['1', '2'], ['ai', 'dev', 'other'])).toEqual([{ id: '1', category: 'ai', tags: ['prompting'], summary: 'Tips.' }]);
  });

  it('accepts a bare results array', () => {
    const rows = parseCategorizeOutput(JSON.stringify([{ id: '2', category: 'dev', tags: ['react'], summary: '' }]), ['2'], ['dev']);
    expect(rows).toHaveLength(1);
  });
});

describe('buildCategorizeRequest', () => {
  it('builds an OpenAI-compatible body and disables thinking only where supported', () => {
    const body = buildCategorizeRequest({ categories, tweets, summaries: true, model: DEFAULT_AI_MODEL });
    expect(body.model).toBe(DEFAULT_AI_MODEL);
    expect(body.messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(body.messages[0]!.content).toContain('"results"');
    expect(body.messages[1]!.content).toContain('<post id="1">');
    expect(body).toMatchObject({ stream: false, chat_template_kwargs: { enable_thinking: false } });
    const other = buildCategorizeRequest({ categories, tweets, summaries: false, model: 'moonshotai/kimi-k2.6' });
    expect(other).not.toHaveProperty('chat_template_kwargs');
  });
});

describe('requestCategorization', () => {
  it('posts to NVIDIA with a bearer key and returns validated results', async () => {
    const fetch = vi.fn(async () => completion(good));
    const res = await requestCategorization({ apiKey: 'nvapi-test', model: DEFAULT_AI_MODEL, categories, tweets, summaries: true, fetch });
    expect(res.results.map((r) => r.category)).toEqual(['ai', 'dev']);
    expect(res.usage).toEqual({ input_tokens: 10, output_tokens: 5 });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${NVIDIA_API_BASE}/chat/completions`);
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer nvapi-test');
  });

  it('classifies failures so callers can retry, split or report them', async () => {
    const call = (fetch: typeof globalThis.fetch) => requestCategorization({ apiKey: 'k', model: DEFAULT_AI_MODEL, categories, tweets, summaries: true, fetch });
    const rate = await call(async () => new Response('{"detail":"Too many requests"}', { status: 429, headers: { 'retry-after': '7' } })).catch((e) => e);
    expect(rate).toBeInstanceOf(AiCallError);
    expect(rate).toMatchObject({ kind: 'http', status: 429, retryAfter: '7', message: 'Too many requests' });
    await expect(call(async () => completion('{"results":[{"id":"1"', 'length'))).rejects.toMatchObject({ kind: 'truncated' });
    await expect(call(async () => completion('I think post 1 is about AI.'))).rejects.toMatchObject({ kind: 'invalid_output' });
    await expect(call(async () => completion('', 'content_filter'))).rejects.toMatchObject({ kind: 'refusal' });
    await expect(
      call(async () => {
        throw new TypeError('Failed to fetch');
      }),
    ).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('extension AI wiring', () => {
  it('reports a rejected key as an auth error', async () => {
    // What integrate.api.nvidia.com actually returns for an invalid key.
    vi.stubGlobal('fetch', async () => new Response('{"status":403,"title":"Forbidden","detail":"Authorization failed"}', { status: 403 }));
    const err = await testApiKey('nvapi-bad', DEFAULT_AI_MODEL).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe('auth');
  });

  it('migrates settings saved by Claude-era builds', () => {
    const s = mergeSettings({ ai: { provider: 'byok', apiKey: 'sk-ant-old', model: 'claude-opus-5-5', summaries: true, autoRun: true } });
    expect(s.ai.model).toBe(DEFAULT_AI_MODEL);
    expect(s.ai.apiKey).toBe('');
    expect(mergeSettings({ ai: { provider: 'byok', apiKey: 'nvapi-x', model: 'moonshotai/kimi-k2.6', summaries: true, autoRun: true } }).ai).toMatchObject({
      apiKey: 'nvapi-x',
      model: 'moonshotai/kimi-k2.6',
    });
  });
});
