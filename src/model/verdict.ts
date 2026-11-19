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
}
export const STANDOVER_MIN = 15;
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
  if (facts.standover < 0) out.push(`No standover clearance (top tube about ${Math.round(-facts.standover)} mm above your inseam)`);
  else if (facts.standover < STANDOVER_MIN) out.push(`Tight standover (about ${Math.round(facts.standover)} mm)`);
  if (facts.seatpost < SEATPOST_MIN) out.push(`Little seatpost showing (${Math.round(facts.seatpost)} mm): the frame is tall for you`);
  if (facts.seatpost > SEATPOST_MAX) out.push(`Very long seatpost showing (${Math.round(facts.seatpost)} mm): the frame is small for you`);
  if (facts.toeClearance < -TOE_OVERLAP_FLAG) out.push(`Toe overlaps the front wheel by about ${Math.round(-facts.toeClearance)} mm`);
  return out;
}

export function verdictOf(problem: FitProblem, ev: Evaluation, flags: string[], postShowing: number): Verdict {
  if (impossible(ev, postShowing)) return 'no';
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
