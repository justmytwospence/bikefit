import { resolveSegments } from '../model/body';
import { forwardLayout } from '../model/geometry';
import type { FitProblem } from '../model/optimize';
import { evaluateFit } from '../model/pose';
import { makeContext } from '../model/riding';
import type { Body, FitParams, PoseEval } from '../model/types';

export interface Mismatch {
  /** Knee extension the model gets for the current setup, degrees; 180 when the foot cannot reach. */
  knee: number;
  over: boolean;
  /** The inseam that would put the knee mid-band with this setup, mm; null when leg lengths are entered by hand or none in range does. */
  inseam: number | null;
}

const MAX_INSEAM = 1050;

/**
 * Whether a setup the rider says they ride is one their measurements say they could hardly ride: the leg
 * overextended, or the knee well past its band. Then the measurements are the likelier mistake, and this says
 * which inseam would make the setup sit mid-band.
 */
export function bodyMismatch(
  pr: Pick<FitProblem, 'frame' | 'components' | 'ankling' | 'effort' | 'targets'>, body: Body, setup: FitParams,
): Mismatch | null {
  const band = pr.targets[0]?.bands.knee;
  if (!band) return null;
  const layout = forwardLayout(pr.frame, pr.components, setup);
  const ctx = makeContext(pr.frame, pr.components, pr.ankling, pr.effort);
  const at = (inseam: number): PoseEval =>
    evaluateFit(resolveSegments({ ...body, inseam }), layout, ctx, pr.targets, 36, false).poses[0];
  const kneeOf = (p: PoseEval) => (p.overextended ? 180 : p.metrics.knee);
  const now = at(body.inseam);
  if (!now.overextended && now.metrics.knee <= band.max + 2 * band.scale) return null;
  const mid = (band.min + band.max) / 2;
  const handLegs = [body.overrides.femur, body.overrides.tibia].some((v) => typeof v === 'number' && v > 0);
  let inseam: number | null = null;
  if (!handLegs && kneeOf(at(MAX_INSEAM)) <= mid) {
    let lo = body.inseam;
    let hi = MAX_INSEAM;
    for (let i = 0; i < 20; i++) {
      const m = (lo + hi) / 2;
      if (kneeOf(at(m)) <= mid) hi = m;
      else lo = m;
    }
    inseam = Math.ceil(hi / 5) * 5;
  }
  return { knee: kneeOf(now), over: now.overextended, inseam };
}
