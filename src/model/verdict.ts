import { fmtNum } from './advice';
import { forwardLayout } from './geometry';
import { impossible } from './limits';
import type { FitProblem } from './optimize';
import { outside, STEM_RISE_FLAG } from './score';
import type { Evaluation, FitParams, Frame, MetricId } from './types';

export type Verdict = 'fits' | 'compromise' | 'no';
export interface FitFacts {
  /** Saddle top above the bar clamp, mm. */
  barDrop: number;
  /** Inseam minus the estimated top tube height, mm. */
  standover: number;
  /** Saddle height minus seat tube length, mm. */
  seatpost: number;
  toeClearance: number;
  /** Hoods relative to the rider's ideal hoods point, mm (x forward, y up); null when no ideal was given. */
  offIdeal: { x: number; y: number } | null;
}
/** Estimated clearance below which no one could stand over the frame; the estimate runs up to 35 mm high. */
export const STANDOVER_NO = -40;
/** Hoods this far from the ideal point make a build a compromise, mm. */
export const OFF_IDEAL_FLAG = 30;
export const SEATPOST_MIN = 80;
export const SEATPOST_MAX = 300;
export const RAIL_FLAG = 18;
export const TOE_OVERLAP_FLAG = 35;
/** A metric this fraction of its scale outside the band (2° for angles) still counts as fitting. */
export const NEAR_TOLERANCE = 0.4;

/** Top tube height above the ground at its midpoint, estimated from stack and seat tube length. */
export function standoverHeight(frame: Frame): number {
  const bbHeight = 311 + frame.tyreWidth - frame.bbDrop;
  const seatTop = frame.seatTubeLength * Math.sin((frame.seatTubeAngle * Math.PI) / 180);
  return bbHeight + (seatTop + frame.stack - 40) / 2 + 15;
}

export function fitFacts(problem: FitProblem, p: FitParams, ev: Evaluation): FitFacts {
  const layout = forwardLayout(problem.frame, problem.components, p);
  return {
    barDrop: layout.saddle.y - layout.clamp.y,
    standover: problem.inseam - standoverHeight(problem.frame),
    seatpost: p.saddleHeight - problem.frame.seatTubeLength,
    toeClearance: ev.toeClearance,
    offIdeal: problem.idealHoods
      ? { x: layout.hoods.x - problem.idealHoods.x, y: layout.hoods.y - problem.idealHoods.y }
      : null,
  };
}

/** Things about the build a shop would call a compromise, in plain words. */
export function buildFlags(problem: FitProblem, p: FitParams, facts: FitFacts): string[] {
  const max = problem.frame.maxSpacers;
  const out: string[] = [];
  if (max > 0 && p.spacers >= max) out.push(`Spacers at the frame's maximum (${fmtNum(max)} mm)`);
  if (p.stemAngle >= STEM_RISE_FLAG) out.push(`Stem angled up (+${fmtNum(p.stemAngle)}°)`);
  if (p.stemAngle <= -17) out.push('Steep −17° stem');
  if (p.stemLength < 70) out.push(`Very short stem (${fmtNum(p.stemLength)} mm)`);
  if (p.stemLength > 130) out.push(`Very long stem (${fmtNum(p.stemLength)} mm)`);
  if (Math.abs(p.railOffset) >= RAIL_FLAG) out.push('Saddle at the end of its rails');
  if (facts.standover < 0) out.push(`Standover looks tight (top tube estimated ${Math.round(-facts.standover)} mm above your inseam)`);
  if (facts.seatpost < SEATPOST_MIN) out.push(`Little seatpost showing (${Math.round(facts.seatpost)} mm): the frame is tall for you`);
  if (facts.seatpost > SEATPOST_MAX) out.push(`Very long seatpost showing (${Math.round(facts.seatpost)} mm): the frame is small for you`);
  const off = facts.offIdeal;
  if (off && Math.hypot(off.x, off.y) > OFF_IDEAL_FLAG) {
    const parts: string[] = [];
    if (Math.abs(off.y) >= 10) parts.push(`${Math.round(Math.abs(off.y))} mm ${off.y < 0 ? 'lower' : 'higher'}`);
    if (Math.abs(off.x) >= 10) parts.push(`${Math.round(Math.abs(off.x))} mm ${off.x < 0 ? 'closer' : 'further away'}`);
    out.push(`Hoods ${parts.join(' and ')} than your ideal position`);
  }
  if (facts.toeClearance < -TOE_OVERLAP_FLAG) out.push(`Toe overlaps the front wheel by about ${Math.round(-facts.toeClearance)} mm`);
  return out;
}

export function verdictOf(problem: FitProblem, ev: Evaluation, flags: string[], facts: FitFacts): Verdict {
  if (impossible(ev, facts.seatpost) || facts.standover < STANDOVER_NO) return 'no';
  let near = false;
  for (let i = 0; i < problem.targets.length; i++) {
    const bands = problem.targets[i].bands;
    for (const k of Object.keys(bands) as MetricId[]) {
      const band = bands[k]!;
      if (band.weight === 0) continue;
      const out = outside(ev.poses[i].metrics[k], band);
      if (out > band.scale) return 'no';
      if (out > NEAR_TOLERANCE * band.scale) near = true;
    }
  }
  return near || flags.length > 0 ? 'compromise' : 'fits';
}

export const VERDICT_RANK: Record<Verdict, number> = { fits: 0, compromise: 1, no: 2 };
