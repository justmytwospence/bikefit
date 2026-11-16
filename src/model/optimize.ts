import { forwardLayout } from './geometry';
import { evaluateFit } from './pose';
import { changePenalty, evaluationCost, fitScore, outside, partPenalty } from './score';
import { METRIC_LABELS, METRIC_ORDER } from './styles';
import type {
  Band, Components, Evaluation, FitParams, Frame, Layout, MetricId, ParamKey, PartOptions, Segments,
} from './types';
import { clamp, type Vec2 } from './vec';

export interface FitProblem {
  segments: Segments;
  inseam: number;
  bands: Record<MetricId, Band>;
  elbowPref: number;
  frame: Frame;
  components: Components;
  options: PartOptions;
  baseline: FitParams;
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
};

export function costOf(problem: FitProblem, p: FitParams): { cost: number; evaluation: Evaluation } {
  const layout = forwardLayout(problem.frame, problem.components, p);
  const evaluation = evaluateFit(problem.segments, layout, problem.components.footStack, problem.elbowPref);
  let cost = evaluationCost(evaluation, problem.bands) + partPenalty(p, problem.options);
  if (problem.mode === 'tune') cost += changePenalty(p, problem.baseline);
  return { cost, evaluation };
}

const snap = (x: number, step: number) => Math.round(x / step) * step;

export function optimizeFit(problem: FitProblem): FitResult {
  const { options: o, baseline: b, locks, frame } = problem;
  const pick = <T>(key: ParamKey, list: T[], base: T): T[] => (locks[key] ? [base] : list);
  const stems = pick('stemLength', o.stemLengths, b.stemLength);
  const angles = pick('stemAngle', o.stemAngles, b.stemAngle);
  const cranks = pick('crankLength', o.crankLengths, b.crankLength);
  const setbacks = pick('seatpostSetback', o.seatpostSetbacks, b.seatpostSetback);

  const lo = [o.saddleHeightRange[0], o.railRange[0], 0];
  const hi = [o.saddleHeightRange[1], o.railRange[1], frame.maxSpacers];
  const minStep = [0.5, 0.5, o.spacerStep];
  const startStep = [16, 8, 2 * o.spacerStep];
  const lockedC = [!!locks.saddleHeight, !!locks.railOffset, !!locks.spacers];

  let start: number[];
  if (problem.mode === 'tune') start = [b.saddleHeight, b.railOffset, b.spacers];
  else start = [0.883 * problem.inseam, 0, 20];
  start = start.map((x, i) => {
    if (lockedC[i]) return [b.saddleHeight, b.railOffset, b.spacers][i];
    return clamp(snap(x, minStep[i]), lo[i], hi[i]);
  });

  interface Cand { cost: number; x: number[]; combo: Omit<FitParams, 'saddleHeight' | 'railOffset' | 'spacers'> }
  const mkP = (c: Cand['combo'], x: number[]): FitParams => ({ saddleHeight: x[0], railOffset: x[1], spacers: x[2], ...c });

  // Pattern search over the continuous knobs for one discrete combination.
  const search = (combo: Cand['combo'], from: number[], steps: number[], mins: number[]): Cand => {
    let x = [...from];
    let cx = costOf(problem, mkP(combo, x)).cost;
    let evals = 1;
    const step = [...steps];
    while (evals < 400) {
      let improved = false;
      for (let i = 0; i < 3; i++) {
        if (lockedC[i]) continue;
        for (const dir of [1, -1]) {
          const y = [...x];
          y[i] = clamp(y[i] + dir * step[i], lo[i], hi[i]);
          if (y[i] === x[i]) continue;
          const cy = costOf(problem, mkP(combo, y)).cost;
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
      for (let i = 0; i < 3; i++) step[i] = Math.max(mins[i], step[i] / 2);
    }
    return { cost: cx, x, combo };
  };

  // Stage 1: coarse search on every combination. Stage 2: refine the best few.
  const coarse: Cand[] = [];
  const coarseMin = [2, 2, o.spacerStep];
  for (const stemLength of stems)
    for (const stemAngle of angles)
      for (const crankLength of cranks)
        for (const seatpostSetback of setbacks)
          coarse.push(search({ stemLength, stemAngle, crankLength, seatpostSetback }, start, startStep, coarseMin));
  coarse.sort((p, q) => p.cost - q.cost);
  let best: Cand | null = null;
  for (const c of coarse.slice(0, 6)) {
    const r = search(c.combo, c.x, [2, 2, o.spacerStep], minStep);
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
  bands: Record<MetricId, Band>,
  elbowPref: number,
  components: Components,
  crankLengths: number[],
): { saddle: Vec2; hand: Vec2; crankLength: number } {
  const H = segments.torso / 0.288;
  const s0 = [-0.126 * H, 0.396 * H, 0.322 * H, 0.372 * H];
  let best: { cost: number; x: number[]; crank: number } | null = null;
  for (const crank of crankLengths) {
    const pen = partPenalty({ crankLength: crank } as FitParams);
    const cost = (x: number[]) => {
      const layout: Layout = {
        saddle: { x: x[0], y: x[1] }, hand: { x: x[2], y: x[3] }, crankLength: crank,
        stemBase: { x: x[2], y: x[3] }, clamp: { x: x[2], y: x[3] }, headTop: { x: x[2], y: x[3] },
        seatAxisTop: { x: x[0], y: x[1] },
      };
      return evaluationCost(evaluateFit(segments, layout, components.footStack, elbowPref), bands) + pen;
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
            x = y; cx = cy; improved = true;
            break;
          }
        }
      }
      if (!improved) step /= 2;
    }
    if (!best || cx < best.cost) best = { cost: cx, x, crank };
  }
  const b = best!;
  return { saddle: { x: b.x[0], y: b.x[1] }, hand: { x: b.x[2], y: b.x[3] }, crankLength: b.crank };
}

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function bindingNotes(problem: FitProblem, result: FitResult): string[] {
  const { bands, options: o, locks, frame } = problem;
  const ev = result.evaluation;
  const offMetrics = METRIC_ORDER.filter((k) => outside(ev.metrics[k], bands[k]) > 0);
  if (!offMetrics.length && !ev.overextended && !ev.overreach) return ['Every angle is inside its target range.'];
  const notes: string[] = [];
  for (const k of offMetrics) {
    const band = bands[k];
    const v = ev.metrics[k];
    notes.push(
      `${METRIC_LABELS[k].short} ends at ${Math.round(v)}${band.unit}, ${v < band.min ? 'below' : 'above'} the ${Math.round(band.min)}–${Math.round(band.max)}${band.unit} target.`,
    );
  }
  if (ev.overextended) notes.push('Leg is overextended at the bottom of the stroke: lower the saddle or shorten the cranks.');
  if (ev.overreach) notes.push('The bars are out of reach: the rider cannot get to the hoods.');
  if (offMetrics.length) {
    const p = result.params;
    const cont: [ParamKey, number, number, number][] = [
      ['saddleHeight', p.saddleHeight, o.saddleHeightRange[0], o.saddleHeightRange[1]],
      ['railOffset', p.railOffset, o.railRange[0], o.railRange[1]],
      ['spacers', p.spacers, 0, frame.maxSpacers],
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
      if (val === list[0]) notes.push(`${PARAM_LABELS[key]} is at the ${loWord} option (${fmtNum(val)}${unit === '°' ? '°' : ' mm'}).`);
      else if (val === list[list.length - 1]) notes.push(`${PARAM_LABELS[key]} is at the ${hiWord} option (${fmtNum(val)}${unit === '°' ? '°' : ' mm'}).`);
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
  return out.length ? out : ['No changes from your current setup.'];
}

export function compareFrames(
  problemFor: Omit<FitProblem, 'frame' | 'mode' | 'locks'>,
  frames: Frame[],
): CompareRow[] {
  return frames
    .map((frame) => ({
      frameId: frame.id,
      frameName: frame.name,
      result: optimizeFit({ ...problemFor, frame, mode: 'shop', locks: {} }),
    }))
    .sort((a, b) => a.result.cost - b.result.cost);
}
