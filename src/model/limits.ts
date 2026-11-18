import type { Evaluation } from './types';

/**
 * Smallest knee angle (included, degrees) at the top of the stroke a rider can pedal through:
 * about 140 degrees of flexion, the usual active range of the knee.
 */
export const MIN_KNEE_TOP = 40;

/**
 * Smallest hip angle (torso to thigh, degrees) a rider can fold to. The tightest time-trial
 * positions close it to about 40; the model's pelvic tilt keeps ordinary fits above 44.
 */
export const MIN_HIP = 35;

/**
 * Saddle top above the top of the seat tube, mm. Below the minimum the post head and saddle would
 * have to sit inside the frame; above the maximum even a long post is out past its minimum insertion.
 */
export const POST_SHOWING: [number, number] = [30, 400];

export type Impossible = 'pedal' | 'knee' | 'bars' | 'hip' | 'postLow' | 'postHigh';

export const IMPOSSIBLE_TEXT: Record<Impossible, string> = {
  pedal: "your foot can't reach the pedal",
  knee: "your knee can't bend that far at the top of the stroke",
  bars: "your hands can't reach the bars",
  hip: "your hip can't fold that far at the top of the stroke",
  postLow: 'the seatpost would have to sink into the frame',
  postHigh: 'the seatpost would come out past its minimum insertion',
};

/**
 * Why this position cannot be ridden or built at all, or null when it can.
 * `postShowing` is saddle height minus seat tube length.
 */
export function impossible(ev: Evaluation, postShowing: number): Impossible | null {
  if (postShowing < POST_SHOWING[0]) return 'postLow';
  if (postShowing > POST_SHOWING[1]) return 'postHigh';
  for (const p of ev.poses) {
    if (p.overextended) return 'pedal';
    if (p.metrics.kneeTop < MIN_KNEE_TOP) return 'knee';
    if (p.metrics.hip < MIN_HIP) return 'hip';
    if (p.overreach) return 'bars';
  }
  return null;
}

/**
 * Optimizer cost for the limits fitCost does not already price (pedal and bars are there):
 * a step so the optimizer avoids them, plus a slope back towards the possible side.
 */
export function limitCost(ev: Evaluation, postShowing: number): number {
  let c = 0;
  if (postShowing < POST_SHOWING[0]) c += 50 + 0.5 * (POST_SHOWING[0] - postShowing);
  if (postShowing > POST_SHOWING[1]) c += 50 + 0.5 * (postShowing - POST_SHOWING[1]);
  let knee = 0;
  let hip = 0;
  for (const p of ev.poses) {
    knee = Math.max(knee, MIN_KNEE_TOP - p.metrics.kneeTop);
    hip = Math.max(hip, MIN_HIP - p.metrics.hip);
  }
  if (knee > 0) c += 50 + knee;
  if (hip > 0) c += 50 + hip;
  return c;
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
