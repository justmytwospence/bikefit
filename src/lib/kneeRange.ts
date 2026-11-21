import { forwardLayout } from '../model/geometry';
import { highestWhere } from '../model/limits';
import type { FitProblem } from '../model/optimize';
import { evaluateFit } from '../model/pose';
import { makeContext } from '../model/riding';
import type { FitParams } from '../model/types';

/**
 * The saddle heights (whole mm, lowest and highest) that keep the knee extension inside its band with the rest of
 * this setup unchanged, or null when none in `range` does. The knee opens as the saddle rises, so both ends are
 * found by bisection.
 */
export function kneeRange(
  pr: Pick<FitProblem, 'segments' | 'frame' | 'components' | 'ankling' | 'effort' | 'targets'>, setup: FitParams,
  range: [number, number],
): [number, number] | null {
  const band = pr.targets[0]?.bands.knee;
  if (!band) return null;
  const ctx = makeContext(pr.frame, pr.components, pr.ankling, pr.effort);
  const knee = (h: number): number => {
    const p = evaluateFit(pr.segments, forwardLayout(pr.frame, pr.components, { ...setup, saddleHeight: h }), ctx, pr.targets, 36, false).poses[0];
    return p.overextended ? 180 : p.metrics.knee;
  };
  const [lo, hi] = [Math.ceil(range[0]), Math.floor(range[1])];
  const top = highestWhere(lo, hi, 1, (h) => knee(h) <= band.max);
  if (top === null) return null;
  const under = highestWhere(lo, hi, 1, (h) => knee(h) < band.min);
  const bottom = under === null ? lo : under + 1;
  return bottom <= top ? [bottom, top] : null;
}
