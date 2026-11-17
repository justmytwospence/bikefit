import { dropsFromHoods, forwardLayout } from './geometry';
import { evaluateFit } from './pose';
import { makeContext } from './riding';
import { changePenalty, fitCost, fitScore, outside, partPenalty } from './score';
import { METRIC_LABELS, METRIC_ORDER } from './styles';
import type {
  Ankling, Components, Effort, Evaluation, FitContext, FitParams, Frame, Layout, MetricId, ParamKey,
  PartOptions, PoseTarget, Segments,
} from './types';
import { clamp, type Vec2 } from './vec';

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
}

export interface FitResult {
  params: FitParams;
  cost: number;
  score: number;
  evaluation: Evaluation;
  notes: string[];
}

export interface CompareRow {
  frameId: string;
  frameName: string;
  result: FitResult;
}

export const PARAM_LABELS: Record<ParamKey, string> = {
  saddleHeight: 'Saddle height',
  railOffset: 'Saddle fore/aft',
  seatpostSetback: 'Seatpost setback',
  spacers: 'Spacers',
  stemLength: 'Stem length',
  stemAngle: 'Stem angle',
  crankLength: 'Crank length',
  cleatOffset: 'Cleat position',
};

function costWith(problem: FitProblem, ctx: FitContext, p: FitParams, steps: number, withToe = false) {
  const layout = forwardLayout(problem.frame, problem.components, p);
  const evaluation = evaluateFit(problem.segments, layout, ctx, problem.targets, steps, withToe);
  let cost = fitCost(evaluation, problem.targets, problem.poseWeights) + partPenalty(p);
  if (problem.mode === 'tune') cost += changePenalty(p, problem.baseline);
  return { cost, evaluation };
}

export function costOf(problem: FitProblem, p: FitParams, steps = 36): { cost: number; evaluation: Evaluation } {
  const ctx = makeContext(problem.frame, problem.components, problem.ankling, problem.effort);
  return costWith(problem, ctx, p, steps, true);
}

const snap = (x: number, step: number) => Math.round(x / step) * step;

export function optimizeFit(problem: FitProblem): FitResult {
  const { options: o, current: b, locks, frame } = problem;
  const ctx = makeContext(frame, problem.components, problem.ankling, problem.effort);
  const pick = <T>(key: ParamKey, list: T[], base: T): T[] => (locks[key] ? [base] : list);
  const stems = pick('stemLength', o.stemLengths, b.stemLength);
  const angles = pick('stemAngle', o.stemAngles, b.stemAngle);
  const cranks = pick('crankLength', o.crankLengths, b.crankLength);
  const setbacks = pick('seatpostSetback', o.seatpostSetbacks, b.seatpostSetback);

  // Continuous variables: saddleHeight, railOffset, spacers, cleatOffset.
  const lo = [o.saddleHeightRange[0], o.railRange[0], 0, o.cleatRange[0]];
  const hi = [o.saddleHeightRange[1], o.railRange[1], frame.maxSpacers, o.cleatRange[1]];
  const lockedC = [!!locks.saddleHeight, !!locks.railOffset, !!locks.spacers, !!locks.cleatOffset];
  const baseC = [b.saddleHeight, b.railOffset, b.spacers, b.cleatOffset];
  const grid = [0.5, 0.5, o.spacerStep, 1];

  const startRaw = problem.mode === 'tune' ? baseC : [0.883 * problem.inseam, 0, 20, 5];
  const start = startRaw.map((x, i) => (lockedC[i] ? baseC[i] : clamp(snap(x, grid[i]), lo[i], hi[i])));

  type Combo = Omit<FitParams, 'saddleHeight' | 'railOffset' | 'spacers' | 'cleatOffset'>;
  interface Cand { cost: number; x: number[]; combo: Combo }
  const mkP = (c: Combo, x: number[]): FitParams => ({
    saddleHeight: x[0], railOffset: x[1], spacers: x[2], cleatOffset: x[3], ...c,
  });

  const search = (combo: Combo, from: number[], steps: number[], mins: number[], samples: number): Cand => {
    let x = [...from];
    let cx = costWith(problem, ctx, mkP(combo, x), samples).cost;
    let evals = 1;
    const step = [...steps];
    while (evals < 500) {
      let improved = false;
      for (let i = 0; i < 4; i++) {
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
      for (let i = 0; i < 4; i++) step[i] = Math.max(mins[i], step[i] / 2);
    }
    return { cost: cx, x, combo };
  };

  // Stage 1: coarse search (12 crank samples) on every combination. Stage 2: refine the best few.
  const coarse: Cand[] = [];
  const startStep = [16, 8, 2 * o.spacerStep, 4];
  const coarseMin = [2, 2, o.spacerStep, 2];
  for (const stemLength of stems)
    for (const stemAngle of angles)
      for (const crankLength of cranks)
        for (const seatpostSetback of setbacks)
          coarse.push(search({ stemLength, stemAngle, crankLength, seatpostSetback }, start, startStep, coarseMin, 12));
  coarse.sort((p, q) => p.cost - q.cost);
  let best: Cand | null = null;
  for (const c of coarse.slice(0, 8)) {
    const r = search(c.combo, c.x, [2, 2, o.spacerStep, 2], [0.5, 0.5, o.spacerStep, 1], 36);
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
  };
  result.notes = bindingNotes(problem, result);
  return result;
}

export function idealLayout(
  segments: Segments,
  targets: PoseTarget[],
  poseWeights: number[],
  ctx: FitContext,
  comp: Components,
  crankLengths: number[],
): { saddle: Vec2; hoods: Vec2; crankLength: number } {
  const H = segments.torso / 0.288;
  const s0 = [-0.126 * H, 0.396 * H, 0.322 * H, 0.372 * H];
  let best: { cost: number; x: number[]; crank: number } | null = null;
  for (const crank of crankLengths) {
    const pen = partPenalty({
      saddleHeight: 0, railOffset: 0, seatpostSetback: 0, spacers: 0, stemLength: 100, stemAngle: 0,
      crankLength: crank, cleatOffset: 5,
    });
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

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const unitText = (u: string) => (u === 'mm' ? ' mm' : u);

export function bindingNotes(problem: FitProblem, result: FitResult): string[] {
  const { options: o, locks, frame } = problem;
  const ev = result.evaluation;
  const notes: string[] = [];
  let anyOff = false;
  problem.targets.forEach((t, i) => {
    const pe = ev.poses[i];
    for (const k of METRIC_ORDER) {
      const band = t.bands[k as MetricId];
      if (!band || band.weight === 0) continue;
      const v = pe.metrics[k];
      if (outside(v, band) <= 0.5) continue;
      anyOff = true;
      const prefix = t.handContact === 'drops' ? 'In the drops: ' : '';
      notes.push(
        `${prefix}${METRIC_LABELS[k].short} ends at ${Math.round(v)}${unitText(band.unit)}, ${v < band.min ? 'below' : 'above'} the ${Math.round(band.min)}–${Math.round(band.max)}${unitText(band.unit)} target.`,
      );
    }
  });
  const over = ev.poses.some((p) => p.overextended);
  const reach = ev.poses.some((p) => p.overreach);
  if (!anyOff && !over && !reach) return ['Every angle is inside its target range.'];
  if (over) notes.push('Leg is overextended at the bottom of the stroke: lower the saddle or shorten the cranks.');
  if (reach) notes.push('The bars are out of reach: the rider cannot get to the hoods.');
  if (anyOff) {
    const p = result.params;
    const cont: [ParamKey, number, number, number][] = [
      ['saddleHeight', p.saddleHeight, o.saddleHeightRange[0], o.saddleHeightRange[1]],
      ['railOffset', p.railOffset, o.railRange[0], o.railRange[1]],
      ['spacers', p.spacers, 0, frame.maxSpacers],
      ['cleatOffset', p.cleatOffset, o.cleatRange[0], o.cleatRange[1]],
    ];
    for (const [key, val, min, max] of cont) {
      if (locks[key]) continue;
      if (val - min <= 0.25) notes.push(`${PARAM_LABELS[key]} is at its minimum (${fmtNum(val)} mm).`);
      else if (max - val <= 0.25) notes.push(`${PARAM_LABELS[key]} is at its maximum (${fmtNum(val)} mm).`);
    }
    const disc: [ParamKey, number[], string, string, string][] = [
      ['stemLength', o.stemLengths, 'mm', 'shortest', 'longest'],
      ['stemAngle', o.stemAngles, '°', 'lowest', 'highest'],
      ['crankLength', o.crankLengths, 'mm', 'shortest', 'longest'],
      ['seatpostSetback', o.seatpostSetbacks, 'mm', 'lowest', 'highest'],
    ];
    for (const [key, list, unit, loWord, hiWord] of disc) {
      if (locks[key]) continue;
      const val = p[key];
      const u = unit === '°' ? '°' : ' mm';
      if (val === list[0]) notes.push(`${PARAM_LABELS[key]} is at the ${loWord} option (${fmtNum(val)}${u}).`);
      else if (val === list[list.length - 1]) notes.push(`${PARAM_LABELS[key]} is at the ${hiWord} option (${fmtNum(val)}${u}).`);
    }
  }
  return notes;
}

const signed = (a: number) => (a === 0 ? '0°' : a < 0 ? `−${fmtNum(-a)}°` : `+${fmtNum(a)}°`);

export function wrenchList(base: FitParams, next: FitParams): string[] {
  const out: string[] = [];
  const dh = next.saddleHeight - base.saddleHeight;
  if (Math.abs(dh) >= 0.5) out.push(dh > 0 ? `Raise the saddle ${fmtNum(dh)} mm` : `Lower the saddle ${fmtNum(-dh)} mm`);
  const dr = next.railOffset - base.railOffset;
  if (Math.abs(dr) >= 0.5)
    out.push(dr > 0 ? `Slide the saddle forward ${fmtNum(dr)} mm on its rails` : `Slide the saddle back ${fmtNum(-dr)} mm on its rails`);
  if (Math.abs(next.seatpostSetback - base.seatpostSetback) >= 0.5)
    out.push(next.seatpostSetback === 0 ? 'Swap to an inline seatpost' : `Swap to a ${fmtNum(next.seatpostSetback)} mm setback seatpost`);
  const ds = next.spacers - base.spacers;
  if (Math.abs(ds) >= 0.5) out.push(ds > 0 ? `Add ${fmtNum(ds)} mm of spacers under the stem` : `Remove ${fmtNum(-ds)} mm of spacers`);
  if (Math.abs(next.stemLength - base.stemLength) >= 0.5 || Math.abs(next.stemAngle - base.stemAngle) >= 0.5)
    out.push(`Swap the ${fmtNum(base.stemLength)} mm ${signed(base.stemAngle)} stem for a ${fmtNum(next.stemLength)} mm ${signed(next.stemAngle)} stem`);
  if (Math.abs(next.crankLength - base.crankLength) >= 0.5) out.push(`Swap to ${fmtNum(next.crankLength)} mm cranks`);
  const dc = next.cleatOffset - base.cleatOffset;
  if (Math.abs(dc) >= 0.5)
    out.push(dc > 0 ? `Move the cleats ${fmtNum(dc)} mm back toward the midfoot` : `Move the cleats ${fmtNum(-dc)} mm forward toward the ball of the foot`);
  return out.length ? out : ['No changes from your current setup.'];
}

export function compareFrames(
  problemFor: Omit<FitProblem, 'frame' | 'mode' | 'locks' | 'current'>,
  frames: Frame[],
): CompareRow[] {
  return frames
    .map((frame) => ({
      frameId: frame.id,
      frameName: frame.name,
      result: optimizeFit({ ...problemFor, frame, current: problemFor.baseline, mode: 'shop', locks: {} }),
    }))
    .sort((a, b) => a.result.cost - b.result.cost);
}
