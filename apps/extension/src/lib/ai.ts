/**
 * AI categorization runner. Two providers share one prompt (packages/shared):
 *  - "byok": calls Claude directly from the browser with the user's own key
 *  - "pro":  calls the hosted twtdash API with the user's license key
 */
import Anthropic from '@anthropic-ai/sdk';
import {
  AI_BATCH_SIZE,
  API_PATHS,
  buildCategorizeRequest,
  FALLBACK_CATEGORY_ID,
  INSTANCE_HEADER,
  parseCategorizeOutput,
  SERVER_FALLBACK_BETA,
  supportsServerFallback,
  type AiCategoryInput,
  type AiResult,
  type AiTweetInput,
  type ApiErrorBody,
  type CategorizeApiRequest,
  type CategorizeApiResponse,
} from '@twtdash/shared';
import { db } from './db';
import { AiError, aiReady } from './ai-config';
import { getSettings, type LicenseInfo } from './storage';
import type { Bookmark, Category } from './types';

export { AiError, aiReady, API_BASE, pendingAiCount, type AiErrorCode } from './ai-config';
import { API_BASE } from './ai-config';

export function toAiTweet(b: Bookmark): AiTweetInput {
  const mediaCounts = b.media.reduce<Record<string, number>>((acc, m) => ((acc[m.type] = (acc[m.type] ?? 0) + 1), acc), {});
  const media = Object.entries(mediaCounts)
    .map(([type, n]) => `${n} ${type === 'photo' ? 'image' : type}${n > 1 ? 's' : ''}`)
    .join(', ');
  return {
    id: b.id,
    author: `@${b.author.handle} (${b.author.name})`,
    text: [b.article?.title, b.text].filter(Boolean).join('\n'),
    links: b.links.map((l) => l.display || l.domain).filter(Boolean),
    quoted: b.quoted ? `@${b.quoted.author.handle}: ${b.quoted.text}` : undefined,
    media: media || undefined,
    cardTitle: b.card?.title,
  };
}

export function toAiCategories(cats: Category[]): AiCategoryInput[] {
  return cats
    .filter((c) => c.enabled)
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.keywords.trim() ? `${c.description} Keywords: ${c.keywords.trim()}.` : c.description,
    }));
}

async function callByok(apiKey: string, model: string, categories: AiCategoryInput[], tweets: AiTweetInput[], summaries: boolean): Promise<AiResult[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  try {
    const response = await client.beta.messages.create({
      ...buildCategorizeRequest({ categories, tweets, summaries }),
      model,
      ...(supportsServerFallback(model) ? { betas: [SERVER_FALLBACK_BETA], fallbacks: 'default' as const } : {}),
    });
    if (response.stop_reason === 'refusal') {
      throw new AiError('Claude declined to categorize this batch.', 'refusal');
    }
    if (response.stop_reason === 'max_tokens') {
      // Output didn't fit: split the batch and try again.
      if (tweets.length <= 1) return [];
      const mid = Math.ceil(tweets.length / 2);
      return [
        ...(await callByok(apiKey, model, categories, tweets.slice(0, mid), summaries)),
        ...(await callByok(apiKey, model, categories, tweets.slice(mid), summaries)),
      ];
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return parseCategorizeOutput(
      text,
      tweets.map((t) => t.id),
      categories.map((c) => c.id),
    );
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new AiError('Your Anthropic API key was rejected. Check it in Settings → AI.', 'auth');
    if (err instanceof Anthropic.PermissionDeniedError) throw new AiError('This API key does not have access to that model.', 'auth');
    if (err instanceof Anthropic.NotFoundError) throw new AiError(`Model "${model}" was not found for this key.`, 'config');
    if (err instanceof Anthropic.RateLimitError) throw new AiError('Anthropic rate limit reached — slowing down.', 'rate', true);
    if (err instanceof Anthropic.BadRequestError) throw new AiError(err.message, 'other');
    if (err instanceof Anthropic.APIConnectionError) throw new AiError('Could not reach Anthropic. Check your connection.', 'network', true);
    if (err instanceof Anthropic.APIError) throw new AiError(err.message, 'other', (err.status ?? 0) >= 500);
    throw err;
  }
}

async function callPro(license: LicenseInfo, categories: AiCategoryInput[], tweets: AiTweetInput[], summaries: boolean): Promise<AiResult[]> {
  const body: CategorizeApiRequest = { categories, tweets, summaries };
  let res: Response;
  try {
    res = await fetch(API_BASE + API_PATHS.categorize, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${license.key}`,
        [INSTANCE_HEADER]: license.instanceId ?? '',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiError('Could not reach twtdash. Check your connection.', 'network', true);
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ApiErrorBody | null;
    const message = err?.error?.message ?? `twtdash API error (${res.status})`;
    switch (err?.error?.code) {
      case 'unauthorized':
      case 'license_invalid':
        throw new AiError('Your twtdash Pro license is not active.', 'license');
      case 'rate_limited':
        throw new AiError('You hit the AI rate limit — slowing down.', 'rate', true);
      case 'refusal':
        throw new AiError('The AI declined to categorize this batch.', 'refusal');
      default:
        throw new AiError(message, 'other', res.status >= 500);
    }
  }
  const data = (await res.json()) as CategorizeApiResponse;
  return data.results ?? [];
}

export interface AiProgress {
  done: number;
  total: number;
  failed: number;
}

export interface AiRunOptions {
  /** Specific posts; defaults to everything not yet processed. */
  ids?: string[];
  /** Re-process posts that already have AI results. */
  force?: boolean;
  signal?: AbortSignal;
  onProgress?: (p: AiProgress) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runAiCategorization(opts: AiRunOptions = {}): Promise<AiProgress> {
  const settings = await getSettings();
  if (!aiReady(settings)) throw new AiError('Set up AI in Settings first.', 'config');

  const cats = await db.categories.toArray();
  const categories = toAiCategories(cats);
  if (!categories.some((c) => c.id === FALLBACK_CATEGORY_ID)) {
    const other = cats.find((c) => c.id === FALLBACK_CATEGORY_ID);
    if (other) categories.push({ id: other.id, name: other.name, description: other.description });
  }

  let targets: Bookmark[];
  if (opts.ids?.length) targets = (await db.bookmarks.bulkGet(opts.ids)).filter((b): b is Bookmark => !!b && !b.partial);
  else targets = await db.bookmarks.filter((b) => !b.partial && (opts.force || !b.aiAt)).toArray();
  targets.sort((a, b) => b.savedAt - a.savedAt);

  const progress: AiProgress = { done: 0, total: targets.length, failed: 0 };
  opts.onProgress?.({ ...progress });
  if (!targets.length) return progress;

  const batches: Bookmark[][] = [];
  for (let i = 0; i < targets.length; i += AI_BATCH_SIZE) batches.push(targets.slice(i, i + AI_BATCH_SIZE));

  const runBatch = async (batch: Bookmark[]) => {
    const tweets = batch.map(toAiTweet);
    for (let attempt = 0; ; attempt++) {
      if (opts.signal?.aborted) return;
      try {
        const results =
          settings.ai.provider === 'byok'
            ? await callByok(settings.ai.apiKey.trim(), settings.ai.model, categories, tweets, settings.ai.summaries)
            : await callPro(settings.license!, categories, tweets, settings.ai.summaries);
        await applyResults(results);
        progress.done += results.length;
        progress.failed += batch.length - results.length;
        opts.onProgress?.({ ...progress });
        return;
      } catch (err) {
        if (err instanceof AiError && err.retryable && attempt < 3) {
          await sleep(4000 * 2 ** attempt);
          continue;
        }
        if (err instanceof AiError && err.code === 'refusal') {
          progress.failed += batch.length;
          opts.onProgress?.({ ...progress });
          return;
        }
        throw err;
      }
    }
  };

  // Two requests in flight keeps things quick without tripping rate limits.
  let next = 0;
  const worker = async () => {
    while (next < batches.length && !opts.signal?.aborted) {
      const batch = batches[next++]!;
      await runBatch(batch);
    }
  };
  await Promise.all([worker(), worker()]);
  return progress;
}

async function applyResults(results: AiResult[]) {
  if (!results.length) return;
  const byId = new Map(results.map((r) => [r.id, r]));
  const now = Date.now();
  await db.bookmarks
    .where('id')
    .anyOf([...byId.keys()])
    .modify((b) => {
      const r = byId.get(b.id)!;
      if (b.categorySource !== 'user') {
        b.category = r.category;
        b.categorySource = 'ai';
      }
      b.tags = [...new Set([...b.tags, ...r.tags])];
      b.summary = r.summary || undefined;
      b.aiAt = now;
      b.updatedAt = now;
    });
}
