import type { Verdict } from '../model/verdict';
import type { ModelGroup, SizeEntry } from './sizes';

export interface ChartPoint {
  key: string;
  name: string;
  entry: SizeEntry;
  /** Frame reach and stack of the model's best size, mm. */
  reach: number;
  stack: number;
  verdict: Verdict;
  score: number;
}

/** The size of a model the list leads with. */
export const bestEntry = (g: ModelGroup): SizeEntry => g.sizes.find((s) => s.row === g.best) ?? g.sizes[0];

/** One point per model: its best size's frame reach and stack. */
export function chartPoints(groups: ModelGroup[]): ChartPoint[] {
  return groups.map((g) => {
    const e = bestEntry(g);
    return {
      key: g.key, name: g.name, entry: e, reach: e.frame.reach, stack: e.frame.stack,
      verdict: e.row.result.verdict, score: e.row.result.score,
    };
  });
}

const median = (xs: number[]): number => {
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/**
 * The frame reach and stack that would put the rider's hands where they belong with a stock stem and the
 * style's usual spacers: each model's best size, shifted by how far its hands land from the ideal point, then
 * the median over models. Null when no model has an ideal to compare against.
 */
export function idealFrame(groups: ModelGroup[]): { reach: number; stack: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const g of groups) {
    const e = bestEntry(g);
    const r = e.row.result.facts.stockRange;
    if (!r) continue;
    // `low` and `high` are offsets of the hoods from the ideal point, so the ideal frame is the frame minus the usual one.
    xs.push(e.frame.reach - (r.low.x + r.share * (r.high.x - r.low.x)));
    ys.push(e.frame.stack - (r.low.y + r.share * (r.high.y - r.low.y)));
  }
  return xs.length ? { reach: median(xs), stack: median(ys) } : null;
}

export interface Area {
  reach: [number, number];
  stack: [number, number];
}

/** Whether a point is inside the area, edges included, whichever way round its ranges were drawn. */
export function inArea(pt: { reach: number; stack: number }, a: Area): boolean {
  const within = (v: number, [p, q]: [number, number]) => v >= Math.min(p, q) && v <= Math.max(p, q);
  return within(pt.reach, a.reach) && within(pt.stack, a.stack);
}
