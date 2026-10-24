/** Accuracy / per-category / confusion metrics for the categorizer eval. */
import { GROUP_BUCKET, type EvalItem } from './dataset';
import { EVAL_CATEGORY_IDS, type EvalGroup } from './types';

export interface Prediction {
  id: string;
  group: EvalGroup;
  gold: string;
  also: string[];
  pred: string;
  hard: boolean;
  text: string;
}

export interface Bucket {
  n: number;
  strict: number;
  lenient: number;
}

export interface CategoryStats {
  support: number;
  predicted: number;
  tp: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface EvalReport {
  overall: Bucket;
  hard: Bucket;
  byBucket: Record<string, Bucket>;
  byGroup: Record<string, Bucket>;
  byCategory: Record<string, CategoryStats>;
  macroF1: number;
  /** Posts sent to "other" although they had a real gold category. */
  missedToOther: number;
  confusions: Array<{ gold: string; pred: string; count: number }>;
  predictions: Prediction[];
}

function bucket(list: Prediction[]): Bucket {
  const n = list.length;
  const strict = list.filter((p) => p.pred === p.gold).length;
  const lenient = list.filter((p) => p.pred === p.gold || p.also.includes(p.pred)).length;
  return { n, strict: n ? strict / n : 0, lenient: n ? lenient / n : 0 };
}

function groupBy<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const t of list) {
    const k = key(t);
    const arr = out.get(k) ?? [];
    arr.push(t);
    out.set(k, arr);
  }
  return out;
}

export function evaluate(items: EvalItem[], predict: (item: EvalItem) => string): EvalReport {
  const predictions: Prediction[] = items.map((it) => ({
    id: it.id,
    group: it.group,
    gold: it.gold,
    also: it.also ?? [],
    pred: predict(it),
    hard: !!it.hard,
    text: it.text,
  }));

  const byBucket: Record<string, Bucket> = {};
  for (const [k, list] of groupBy(predictions, (p) => GROUP_BUCKET[p.group])) byBucket[k] = bucket(list);
  const byGroup: Record<string, Bucket> = {};
  for (const [k, list] of groupBy(predictions, (p) => p.group)) byGroup[k] = bucket(list);

  const byCategory: Record<string, CategoryStats> = {};
  const f1s: number[] = [];
  for (const c of EVAL_CATEGORY_IDS) {
    const support = predictions.filter((p) => p.gold === c).length;
    const predicted = predictions.filter((p) => p.pred === c).length;
    const tp = predictions.filter((p) => p.gold === c && p.pred === c).length;
    const precision = predicted ? tp / predicted : 0;
    const recall = support ? tp / support : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    byCategory[c] = { support, predicted, tp, precision, recall, f1 };
    if (support) f1s.push(f1);
  }

  const pairs = new Map<string, number>();
  for (const p of predictions) if (p.pred !== p.gold) pairs.set(`${p.gold}→${p.pred}`, (pairs.get(`${p.gold}→${p.pred}`) ?? 0) + 1);
  const confusions = [...pairs.entries()]
    .map(([k, count]) => {
      const [gold, pred] = k.split('→') as [string, string];
      return { gold, pred, count };
    })
    .sort((a, b) => b.count - a.count || a.gold.localeCompare(b.gold));

  return {
    overall: bucket(predictions),
    hard: bucket(predictions.filter((p) => p.hard)),
    byBucket,
    byGroup,
    byCategory,
    macroF1: f1s.length ? f1s.reduce((a, b) => a + b, 0) / f1s.length : 0,
    missedToOther: predictions.filter((p) => p.gold !== 'other' && p.pred === 'other').length,
    confusions,
    predictions,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function summaryLine(name: string, r: EvalReport): string {
  return `${name}: n=${r.overall.n} strict=${pct(r.overall.strict)} lenient=${pct(r.overall.lenient)} macroF1=${pct(r.macroF1)} hard=${pct(r.hard.strict)} (n=${r.hard.n}) →other=${r.missedToOther}`;
}

/** Markdown tables comparing several runs (e.g. baseline vs final) on one split. */
export function markdownTables(runs: Array<{ name: string; report: EvalReport }>): string {
  const head = (cols: string[]) => `| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|\n`;
  const names = runs.map((r) => r.name);
  let md = '';

  md += head(['Metric', ...names]);
  md += `| Strict accuracy | ${runs.map((r) => pct(r.report.overall.strict)).join(' | ')} |\n`;
  md += `| Lenient accuracy | ${runs.map((r) => pct(r.report.overall.lenient)).join(' | ')} |\n`;
  md += `| Macro F1 | ${runs.map((r) => pct(r.report.macroF1)).join(' | ')} |\n`;
  md += `| Hard posts (strict) | ${runs.map((r) => `${pct(r.report.hard.strict)} (n=${r.report.hard.n})`).join(' | ')} |\n`;
  md += `| Real posts sent to "other" | ${runs.map((r) => String(r.report.missedToOther)).join(' | ')} |\n\n`;

  const buckets = [...new Set(runs.flatMap((r) => Object.keys(r.report.byBucket)))];
  md += head(['Language group', 'n', ...names.map((n) => `${n} strict`)]);
  for (const b of buckets) md += `| ${b} | ${runs[0]!.report.byBucket[b]?.n ?? 0} | ${runs.map((r) => pct(r.report.byBucket[b]?.strict ?? 0)).join(' | ')} |\n`;
  md += '\n';

  const groups = [...new Set(runs.flatMap((r) => Object.keys(r.report.byGroup)))];
  md += head(['Group', 'n', ...names.map((n) => `${n} strict`)]);
  for (const g of groups) md += `| ${g} | ${runs[0]!.report.byGroup[g]?.n ?? 0} | ${runs.map((r) => pct(r.report.byGroup[g]?.strict ?? 0)).join(' | ')} |\n`;
  md += '\n';

  md += head(['Category', 'support', ...names.flatMap((n) => [`${n} P`, `${n} R`, `${n} F1`])]);
  for (const c of EVAL_CATEGORY_IDS) {
    const s = runs[0]!.report.byCategory[c]!;
    md += `| ${c} | ${s.support} | ${runs
      .flatMap((r) => {
        const x = r.report.byCategory[c]!;
        return [pct(x.precision), pct(x.recall), pct(x.f1)];
      })
      .join(' | ')} |\n`;
  }
  md += '\n';
  return md;
}

export function confusionList(r: EvalReport, top = 12): string {
  return r.confusions
    .slice(0, top)
    .map((c) => `${c.gold} → ${c.pred}: ${c.count}`)
    .join('\n');
}
