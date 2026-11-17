import type { CompareRow } from '../model/optimize';

/**
 * Rows of one model's sizes, evaluated outward from `start`: both neighbours always, then onward in each
 * direction while the last size still fits (verdict not 'no'). Returned in size order.
 */
export function walkSizes(n: number, start: number, evaluate: (i: number) => CompareRow): CompareRow[] {
  const done = new Map<number, CompareRow>();
  const ev = (i: number) => {
    let r = done.get(i);
    if (!r) done.set(i, (r = evaluate(i)));
    return r;
  };
  ev(start);
  for (const dir of [-1, 1]) {
    for (let i = start + dir; i >= 0 && i < n; i += dir) {
      if (ev(i).result.verdict === 'no') break;
    }
  }
  return [...done.keys()].sort((a, b) => a - b).map((i) => done.get(i)!);
}
