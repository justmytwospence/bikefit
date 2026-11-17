import { dropsFromHoods, forwardLayout } from './geometry';
import { evaluateFit } from './pose';
import { makeContext } from './riding';
import { buildPenalty, changePenalty, fitCost, fitScore, outside, partPenalty, STEM_RISE_FLAG } from './score';
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
  flags: string[];
  verdict: Verdict;
  facts: FitFacts;
}

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

export function verdictOf(problem: FitProblem, ev: Evaluation, flags: string[]): Verdict {
  if (ev.poses.some((p) => p.overextended || p.overreach)) return 'no';
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
  let cost = fitCost(evaluation, problem.targets, problem.poseWeights) + partPenalty(p) + buildPenalty(p, problem.frame.maxSpacers);
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
    flags: [],
    verdict: 'fits',
    facts: fitFacts(problem, bestParams, bestEval),
  };
  result.notes = bindingNotes(problem, result);
  result.flags = buildFlags(problem, bestParams, result.facts);
  result.verdict = verdictOf(problem, bestEval, result.flags);
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

const VERDICT_RANK: Record<Verdict, number> = { fits: 0, compromise: 1, no: 2 };

const signed = (a: number) => (a === 0 ? '0°' : a < 0 ? `−${fmtNum(-a)}°` : `+${fmtNum(a)}°`);

/** One line describing the parts a build uses. */
export function buildSummary(p: FitParams, withCleats: boolean): string {
  const angle = `${p.stemAngle < 0 ? '−' : p.stemAngle > 0 ? '+' : ''}${Math.abs(p.stemAngle)}°`;
  const post = p.seatpostSetback === 0 ? 'inline post' : `${p.seatpostSetback} mm setback`;
  const cleats = withCleats ? ` · cleats ${p.cleatOffset} mm back` : '';
  return `${p.stemLength} mm ${angle} stem · ${p.spacers} mm spacers · ${p.crankLength} mm cranks · ${post}${cleats}`;
}

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
    .sort((a, b) => VERDICT_RANK[a.result.verdict] - VERDICT_RANK[b.result.verdict] || a.result.cost - b.result.cost);
}
