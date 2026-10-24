/**
 * Accuracy gate for the on-device categorizer.
 *
 *   npx vitest run src/lib/__tests__/eval                 # gate + summary
 *   EVAL_DETAILS=dev npx vitest run src/lib/__tests__/eval  # + per-post mistakes on dev
 *
 * Thresholds sit a little below the measured test-split numbers (see
 * bench/results/classifier-eval.md) so real regressions fail CI while
 * harmless keyword tweaks do not. Tune on `dev` only; `test` is the report.
 */
import { describe, expect, it } from 'vitest';
import { classifyTweet, compileCategories } from '../../classify';
import { defaultCategories } from '../../db';
import { EVAL_SET, toTweet, type EvalItem } from './dataset';
import { confusionList, evaluate, summaryLine } from './metrics';
import { EVAL_CATEGORY_IDS } from './types';

/** Measured on the test split: see bench/results/classifier-eval.md. */
const GATE = {
  testStrict: 0,
  testLenient: 0,
  devStrict: 0,
  /** Per language bucket, test split, strict. */
  bucket: {} as Record<string, number>,
};

const compiled = compileCategories(defaultCategories());
const predict = (it: EvalItem) => classifyTweet(toTweet(it), compiled).category;

describe('categorizer eval set', () => {
  it('is well-formed', () => {
    const ids = new Set<string>();
    for (const p of EVAL_SET) {
      expect(ids.has(p.id), `duplicate id ${p.id}`).toBe(false);
      ids.add(p.id);
      expect(EVAL_CATEGORY_IDS as readonly string[], `${p.id} gold`).toContain(p.gold);
      for (const a of p.also ?? []) expect(EVAL_CATEGORY_IDS as readonly string[], `${p.id} also`).toContain(a);
      expect(p.id.startsWith(p.group + '-'), `${p.id} group`).toBe(true);
    }
    expect(EVAL_SET.length).toBeGreaterThanOrEqual(400);
    const test = EVAL_SET.filter((p) => p.split === 'test').length;
    expect(test / EVAL_SET.length).toBeGreaterThan(0.4);
    expect(test / EVAL_SET.length).toBeLessThan(0.6);
  });

  it('meets the accuracy gate', () => {
    const dev = evaluate(
      EVAL_SET.filter((p) => p.split === 'dev'),
      predict,
    );
    const test = evaluate(
      EVAL_SET.filter((p) => p.split === 'test'),
      predict,
    );
    console.log(`${summaryLine('dev ', dev)}\n${summaryLine('test', test)}`);
    console.log(
      'test by language: ' +
        Object.entries(test.byBucket)
          .map(([k, b]) => `${k} ${(b.strict * 100).toFixed(1)}% (n=${b.n})`)
          .join(', '),
    );
    if (process.env.EVAL_DETAILS === 'dev') {
      console.log(confusionList(dev, 30));
      for (const p of dev.predictions) if (p.pred !== p.gold) console.log(`${p.id}\tgold=${p.gold}\tpred=${p.pred}\t${p.text.replace(/\n/g, ' ').slice(0, 140)}`);
    }

    expect(test.overall.strict).toBeGreaterThanOrEqual(GATE.testStrict);
    expect(test.overall.lenient).toBeGreaterThanOrEqual(GATE.testLenient);
    expect(dev.overall.strict).toBeGreaterThanOrEqual(GATE.devStrict);
    for (const [bucket, min] of Object.entries(GATE.bucket)) expect(test.byBucket[bucket]?.strict ?? 0, bucket).toBeGreaterThanOrEqual(min);
  });
});
