import type { Evaluation } from './types';

/**
 * Smallest knee angle (included, degrees) at the top of the stroke a rider can pedal through:
 * about 140 degrees of flexion, the usual active range of the knee.
 */
export const MIN_KNEE_TOP = 40;

export type Impossible = 'pedal' | 'knee' | 'bars';

export const IMPOSSIBLE_TEXT: Record<Impossible, string> = {
  pedal: "your foot can't reach the pedal",
  knee: "your knee can't bend that far at the top of the stroke",
  bars: "your hands can't reach the bars",
};

/** Why the body cannot ride this position at all, or null when it can. */
export function impossible(ev: Evaluation): Impossible | null {
  for (const p of ev.poses) {
    if (p.overextended) return 'pedal';
    if (p.metrics.kneeTop < MIN_KNEE_TOP) return 'knee';
    if (p.overreach) return 'bars';
  }
  return null;
}

/**
 * The stretch of [lo, hi] (on the `step` grid) the body can ride, given a check that says why a
 * value is impossible. Picks the stretch holding `current`, or the one nearest it, and always
 * keeps `current` reachable so a setup that is already impossible can be dragged back.
 * Returns the full range when nothing in it is possible: other knobs are the problem then.
 * `lowWhy` and `highWhy` say what stops each end, when something does.
 */
export function possibleRange(
  lo: number, hi: number, step: number, current: number, why: (v: number) => Impossible | null,
): { lo: number; hi: number; lowWhy: Impossible | null; highWhy: Impossible | null } {
  const n = Math.max(1, Math.round((hi - lo) / step));
  const at = (i: number) => (i >= n ? hi : lo + i * step);
  const ok = (i: number) => why(at(i)) === null;
  // Coarse scan, then bisection at the edges of the chosen stretch.
  const stride = Math.max(1, Math.floor(n / 48));
  const coarse: number[] = [];
  for (let i = 0; i < n; i += stride) coarse.push(i);
  coarse.push(n);
  const good = coarse.map(ok);
  const runs: [number, number][] = [];
  for (let k = 0; k < coarse.length; k++) {
    if (!good[k]) continue;
    if (k > 0 && good[k - 1]) runs[runs.length - 1][1] = k;
    else runs.push([k, k]);
  }
  if (!runs.length) return { lo, hi, lowWhy: null, highWhy: null };
  const ci = Math.round((current - lo) / step);
  const dist = ([a, b]: [number, number]) => (ci < coarse[a] ? coarse[a] - ci : ci > coarse[b] ? ci - coarse[b] : 0);
  const [ra, rb] = runs.reduce((best, r) => (dist(r) < dist(best) ? r : best));
  // Lowest possible index between coarse[ra - 1] (impossible) and coarse[ra] (possible).
  let a = coarse[ra];
  if (ra > 0) {
    let bad = coarse[ra - 1];
    while (a - bad > 1) {
      const m = (a + bad) >> 1;
      if (ok(m)) a = m;
      else bad = m;
    }
  }
  let b = coarse[rb];
  if (rb < coarse.length - 1) {
    let bad = coarse[rb + 1];
    while (bad - b > 1) {
      const m = (b + bad) >> 1;
      if (ok(m)) b = m;
      else bad = m;
    }
  }
  const lowWhy = a > 0 ? why(at(a - 1)) : null;
  const highWhy = b < n ? why(at(b + 1)) : null;
  return { lo: Math.min(at(a), current), hi: Math.max(at(b), current), lowWhy, highWhy };
}
