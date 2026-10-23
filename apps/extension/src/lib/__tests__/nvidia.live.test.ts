/**
 * Live check against NVIDIA's free API with your own key — skipped unless
 * NVIDIA_API_KEY is set:
 *   NVIDIA_API_KEY=nvapi-… npm run test:live
 * Runs one small categorization batch through every model offered in Settings.
 */
import { AI_MODELS, requestCategorization, type AiCategoryInput, type AiTweetInput } from '@twtdash/shared';
import { describe, expect, it } from 'vitest';

const apiKey = process.env.NVIDIA_API_KEY?.trim();

const categories: AiCategoryInput[] = [
  { id: 'ai', name: 'AI & ML', description: 'Artificial intelligence, LLMs, machine learning, AI products, prompting and agents.' },
  { id: 'dev', name: 'Programming', description: 'Software engineering, code, languages, frameworks and devtools.' },
  { id: 'health', name: 'Health & Fitness', description: 'Exercise, nutrition, sleep and wellbeing.' },
  { id: 'other', name: 'Other', description: 'Anything that does not clearly fit another category.' },
];
const tweets: AiTweetInput[] = [
  { id: '1', author: '@mayabuilds (Maya Chen)', text: 'Spent the weekend turning our support tickets into an eval set. Biggest lesson: write the grader before the prompt.' },
  { id: '2', author: '@diegoships (Diego Alvarez)', text: 'Most React performance problems are just state living too high in the tree.', links: ['react.dev/learn'] },
  { id: '3', author: '@coachlena (Lena Park)', text: 'Zone 2 cardio three times a week did more for my sleep than any supplement I have tried.' },
];

describe.skipIf(!apiKey)('NVIDIA API (live)', () => {
  for (const model of AI_MODELS) {
    it(`${model.label} categorizes a batch`, { timeout: 120_000 }, async () => {
      const started = Date.now();
      const res = await requestCategorization({ apiKey: apiKey!, model: model.id, categories, tweets, summaries: true });
      console.log(`${model.id}: ${res.results.length}/3 in ${Date.now() - started} ms →`, res.results.map((r) => `${r.id}:${r.category} [${r.tags.join(', ')}]`).join('  '));
      expect(res.results.length).toBeGreaterThanOrEqual(2);
      expect(res.results.find((r) => r.id === '2')?.category).toBe('dev');
    });
  }
});
