import { bindingNotes } from './advice';
import { dropsFromHoods, forwardLayout } from './geometry';
import { limitCost } from './limits';
import { evaluateFit } from './pose';
import { makeContext } from './riding';
import { buildPenalty, changePenalty, COMPROMISE_COST, crankFor, cranksAround, cranksNear, fitCost, fitScore, frameCost, partPenalty, sizingPenalty } from './score';
import type {
  Ankling, Components, Effort, Evaluation, FitContext, FitParams, Frame, Layout, ParamKey,
  PartOptions, PoseTarget, Segments, StockCockpit,
} from './types';
import { clamp, type Vec2 } from './vec';
import { buildFlags, fitFacts, verdictOf, type FitFacts, type Verdict } from './verdict';

export interface FitProblem {
  segments: Segments;
  inseam: number;
  targets: PoseTarget[];
  poseWeights: number[];
  ankling: Ankling;
  effort: Effort;
  frame: Frame;
  components: Components;
  options: PartOptions;
  baseline: FitParams;
  /** Where the sliders are now: a tune starts here and every locked knob keeps this value. */
  current: FitParams;
  locks: Partial<Record<ParamKey, boolean>>;
  mode: 'tune' | 'shop';
  /** The rider's ideal hoods point; new builds are ranked by distance from it. Worked out when absent. */
  idealHoods?: Vec2;
  /** The cockpit the riding style is anchored on; new builds are ranked by how far it sits from the ideal point. */
  stock?: StockCockpit;
  /** The crank length the score measures against, when not in proportion to the legs (a fit report's). */
  crankRef?: number;
}

export interface FitResult {
  params: FitParams;
  cost: number;
  score: number;
  evaluation: Evaluation;
  notes: string[];
  flags: string[];
  verdict: Verdict;
  facts: FitFacts;
}

export interface CompareRow {
  frameId: string;
  frameName: string;
  result: FitResult;
}

function costWith(problem: FitProblem, ctx: FitContext, p: FitParams, steps: number, withToe = false) {
  const layout = forwardLayout(problem.frame, problem.components, p);
  const evaluation = evaluateFit(problem.segments, layout, ctx, problem.targets, steps, withToe);
  let cost = fitCost(evaluation, problem.targets, problem.poseWeights) + partPenalty(p, problem.crankRef ?? crankFor(problem.inseam)) + buildPenalty(p, problem.frame.maxSpacers)
    + limitCost(evaluation, p.saddleHeight - problem.frame.seatTubeLength);
  if (problem.mode === 'tune') cost += changePenalty(p, problem.baseline);
  else cost += sizingPenalty(p, problem.frame, layout.hoods, problem.idealHoods);
  return { cost, evaluation };
}

export function costOf(problem: FitProblem, p: FitParams, steps = 36): { cost: number; evaluation: Evaluation } {
  const ctx = makeContext(problem.frame, problem.components, problem.ankling, problem.effort);
  return costWith(problem, ctx, p, steps, true);
}

const snap = (x: number, step: number) => Math.round(x / step) * step;

type IdealInput = Pick<FitProblem, 'segments' | 'inseam' | 'targets' | 'poseWeights' | 'components' | 'ankling' | 'effort' | 'options' | 'idealHoods'>;
function idealHoodsFor(p: IdealInput): Vec2 {
  return p.idealHoods ?? idealLayout(
    p.segments, p.targets, p.poseWeights, makeContext(null, p.components, p.ankling, p.effort), p.components, p.options.crankLengths, p.inseam,
  ).hoods;
}

export function optimizeFit(input: FitProblem): FitResult {
  const problem = input.mode === 'shop' ? { ...input, idealHoods: idealHoodsFor(input) } : input;
  const { options: o, current: b, locks, frame } = problem;
  const ctx = makeContext(frame, problem.components, problem.ankling, problem.effort);
  const pick = <T>(key: ParamKey, list: T[], base: T): T[] => (locks[key] ? [base] : list);
  const stems = pick('stemLength', o.stemLengths, b.stemLength);
  const angles = pick('stemAngle', o.stemAngles, b.stemAngle);
  const cranks = pick('crankLength', problem.crankRef !== undefined
    ? cranksAround(o.crankLengths, problem.crankRef, b.crankLength)
    : cranksNear(o.crankLengths, problem.inseam, b.crankLength), b.crankLength);
  const setbacks = pick('seatpostSetback', o.seatpostSetbacks, b.seatpostSetback);

  // Continuous variables: saddleHeight, railOffset, spacers, cleatOffset, saddleTilt (new builds keep the saddle level).
  const shop = problem.mode === 'shop';
  const lo = [o.saddleHeightRange[0], o.railRange[0], 0, o.cleatRange[0], o.saddleTiltRange[0]];
  const hi = [o.saddleHeightRange[1], o.railRange[1], frame.maxSpacers, o.cleatRange[1], o.saddleTiltRange[1]];
  const lockedC = [!!locks.saddleHeight, !!locks.railOffset, !!locks.spacers, !!locks.cleatOffset, !!locks.saddleTilt || shop];
  const baseC = [b.saddleHeight, b.railOffset, b.spacers, b.cleatOffset, shop ? 0 : b.saddleTilt];
  const grid = [0.5, 0.5, o.spacerStep, 1, 0.5];

  const startRaw = problem.mode === 'tune' ? baseC : [0.883 * problem.inseam, 0, 20, 5, 0];
  const start = startRaw.map((x, i) => (lockedC[i] ? baseC[i] : clamp(snap(x, grid[i]), lo[i], hi[i])));

  type Combo = Omit<FitParams, 'saddleHeight' | 'railOffset' | 'spacers' | 'cleatOffset' | 'saddleTilt'>;
  interface Cand { cost: number; x: number[]; combo: Combo }
  const mkP = (c: Combo, x: number[]): FitParams => ({
    saddleHeight: x[0], railOffset: x[1], spacers: x[2], cleatOffset: x[3], saddleTilt: x[4], ...c,
  });

  const search = (combo: Combo, from: number[], steps: number[], mins: number[], samples: number): Cand => {
    let x = [...from];
    let cx = costWith(problem, ctx, mkP(combo, x), samples).cost;
    let evals = 1;
    const step = [...steps];
    while (evals < 500) {
      let improved = false;
      for (let i = 0; i < x.length; i++) {
        if (lockedC[i]) continue;
        for (const dir of [1, -1]) {
          const y = [...x];
          y[i] = clamp(y[i] + dir * step[i], lo[i], hi[i]);
          if (y[i] === x[i]) continue;
          const cy = costWith(problem, ctx, mkP(combo, y), samples).cost;
          evals++;
          if (cy < cx - 1e-9) {
            x = y;
            cx = cy;
            improved = true;
            break;
          }
        }
      }
      if (improved) continue;
      if (step.every((s, i) => lockedC[i] || s <= mins[i])) break;
      for (let i = 0; i < step.length; i++) step[i] = Math.max(mins[i], step[i] / 2);
    }
    return { cost: cx, x, combo };
  };

  // Stage 1: coarse search (12 crank samples) on every combination. Stage 2: refine the best few.
  const coarse: Cand[] = [];
  const startStep = [16, 8, 2 * o.spacerStep, 4, 2];
  const coarseMin = [2, 2, o.spacerStep, 2, 1];
  for (const stemLength of stems)
    for (const stemAngle of angles)
      for (const crankLength of cranks)
        for (const seatpostSetback of setbacks)
          coarse.push(search({ stemLength, stemAngle, crankLength, seatpostSetback, barRoll: shop ? 0 : b.barRoll }, start, startStep, coarseMin, 12));
  coarse.sort((p, q) => p.cost - q.cost);
  let best: Cand | null = null;
  for (const c of coarse.slice(0, 8)) {
    const r = search(c.combo, c.x, [2, 2, o.spacerStep, 2, 1], [0.5, 0.5, o.spacerStep, 1, 0.5], 36);
    if (!best || r.cost < best.cost) best = r;
  }
  const bestParams = mkP(best!.combo, best!.x);
  const bestEval = costOf(problem, bestParams).evaluation;

  const result: FitResult = {
    params: bestParams,
    cost: best!.cost,
    score: fitScore(best!.cost),
    evaluation: bestEval,
    notes: [],
    flags: [],
    verdict: 'fits',
    facts: fitFacts(problem, bestParams, bestEval),
  };
  if (result.facts.stockRange) {
    result.cost += frameCost(result.facts.stockRange);
    result.score = fitScore(result.cost);
  }
  result.notes = bindingNotes(problem, result);
  result.flags = buildFlags(problem, bestParams, result.facts);
  result.verdict = verdictOf(problem, bestEval, result.flags, result.facts);
  if (result.verdict === 'compromise') {
    result.cost += COMPROMISE_COST;
    result.score = fitScore(result.cost);
  }
  return result;
}

export function idealLayout(
  segments: Segments,
  targets: PoseTarget[],
  poseWeights: number[],
  ctx: FitContext,
  comp: Components,
  crankLengths: number[],
  inseam: number,
): { saddle: Vec2; hoods: Vec2; crankLength: number } {
  const H = segments.stature;
  const s0 = [-0.126 * H, 0.396 * H, 0.322 * H, 0.372 * H];
  let best: { cost: number; x: number[]; crank: number } | null = null;
  const crankRef = crankFor(inseam);
  for (const crank of cranksNear(crankLengths, inseam)) {
    const pen = partPenalty({
      saddleHeight: 0, railOffset: 0, seatpostSetback: 0, spacers: 0, stemLength: 100, stemAngle: 0,
      crankLength: crank, cleatOffset: 5, saddleTilt: 0, barRoll: 0,
    }, crankRef);
    const cost = (x: number[]) => {
      const hoods = { x: x[2], y: x[3] };
      const layout: Layout = {
        saddle: { x: x[0], y: x[1] },
        nose: { x: x[0] + comp.saddleLength - 120, y: x[1] },
        hoods,
        drops: dropsFromHoods(hoods, comp),
        crankLength: crank,
        cleatOffset: 5,
        stemBase: hoods, clamp: hoods, headTop: hoods,
        seatAxisTop: { x: x[0], y: x[1] },
      };
      return fitCost(evaluateFit(segments, layout, ctx, targets, 36, false), targets, poseWeights) + pen;
    };
    let x = [...s0];
    let cx = cost(x);
    let step = 32;
    while (step >= 0.5) {
      let improved = false;
      for (let i = 0; i < 4; i++) {
        for (const dir of [1, -1]) {
          const y = [...x];
          y[i] = clamp(y[i] + dir * step, s0[i] - 400, s0[i] + 400);
          if (y[i] === x[i]) continue;
          const cy = cost(y);
          if (cy < cx - 1e-9) {
            x = y;
            cx = cy;
            improved = true;
            break;
          }
        }
      }
      if (!improved) step /= 2;
    }
    if (!best || cx < best.cost) best = { cost: cx, x, crank };
  }
  const b = best!;
  return { saddle: { x: b.x[0], y: b.x[1] }, hoods: { x: b.x[2], y: b.x[3] }, crankLength: b.crank };
}

/** Bikes that do not fit last; the rest by cost, which already counts a compromise. */
export const byVerdictThenCost = (a: CompareRow, b: CompareRow) =>
  Number(a.result.verdict === 'no') - Number(b.result.verdict === 'no') || a.result.cost - b.result.cost;

export function compareFrames(
  problemFor: Omit<FitProblem, 'frame' | 'mode' | 'locks' | 'current'>,
  frames: Frame[],
  locks: Partial<Record<ParamKey, boolean>> = {},
): CompareRow[] {
  const idealHoods = idealHoodsFor(problemFor);
  return frames
    .map((frame) => ({
      frameId: frame.id,
      frameName: frame.name,
      result: optimizeFit({ ...problemFor, idealHoods, frame, current: problemFor.baseline, mode: 'shop', locks }),
    }))
    .sort(byVerdictThenCost);
}

/** Optimize one problem on several frames (the sizes of a model), best first. Keeps the problem's locks. */
export function optimizeSizes(problem: FitProblem, frames: Frame[]): CompareRow[] {
  const p = problem.mode === 'shop' ? { ...problem, idealHoods: idealHoodsFor(problem) } : problem;
  return frames
    .map((frame) => ({ frameId: frame.id, frameName: frame.name, result: optimizeFit({ ...p, frame }) }))
    .sort(byVerdictThenCost);
}
