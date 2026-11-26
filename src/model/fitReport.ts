import { resolveSegments } from './body';
import { dropsFromHoods, forwardLayout, railForSetback } from './geometry';
import { evaluateFit } from './pose';
import { DEFAULT_PARAMS } from './presets';
import { makeContext } from './riding';
import { band, STYLES } from './styles';
import type {
  Ankling, Body, Components, Effort, FitParams, Frame, Layout, MetricId, PartOptions, PoseTarget, Segments, Style,
} from './types';
import { clamp, deg, rad, type Vec2 } from './vec';

/**
 * The numbers off a professional fit report, named as on a Retul Zin report. Distances are in mm from the
 * bottom bracket centre (x forward, y up); "the middle of the saddle top" is the point 135 mm behind a 270 mm
 * saddle's nose.
 */
export interface FitReport {
  label: string;
  /** BB centre to the middle of the saddle top. */
  saddleHeight: number;
  /** BB centre to the middle of the saddle top, degrees from horizontal. */
  seatAngle: number;
  /** BB centre to the saddle nose, horizontally; negative when the nose is behind the BB. */
  saddleSetback: number;
  /** Degrees, + nose up. */
  saddleAngle: number;
  /** BB centre forward to the trough of the hoods. */
  gripReach: number;
  /** Middle of the saddle top down to the trough of the hoods; negative when lower. */
  gripDrop: number;
  crankLength: number;
}

export interface ReportPosition {
  saddle: Vec2;
  nose: Vec2;
  hoods: Vec2;
  crankLength: number;
  saddleTilt: number;
}

export interface PositionMatch {
  params: FitParams;
  /** Where the saddle ends up relative to the report, mm. */
  saddleOff: Vec2;
  /** Where the hoods end up relative to the report, mm. */
  hoodsOff: Vec2;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The contact points a report describes, in the model's frame: `saddle` is the point `saddleLength - 120` behind the nose. */
export function reportPosition(r: FitReport, comp: Components): ReportPosition {
  const t = rad(r.saddleAngle);
  const s = rad(r.seatAngle);
  const L = comp.saddleLength - 120;
  const M = { x: -r.saddleHeight * Math.cos(s), y: r.saddleHeight * Math.sin(s) };
  const nose = { x: r.saddleSetback, y: M.y + (r.saddleSetback - M.x) * Math.tan(t) };
  const saddle = { x: nose.x - L * Math.cos(t), y: nose.y - L * Math.sin(t) };
  const hoods = { x: r.gripReach, y: M.y + r.gripDrop };
  return { saddle, nose, hoods, crankLength: r.crankLength, saddleTilt: r.saddleAngle };
}

/** The report as a layout with nothing but contact points, for scoring a position without a frame. */
export function reportLayout(r: FitReport, comp: Components): Layout {
  const pos = reportPosition(r, comp);
  return {
    saddle: pos.saddle, nose: pos.nose, hoods: pos.hoods, drops: dropsFromHoods(pos.hoods, comp),
    crankLength: pos.crankLength, cleatOffset: DEFAULT_PARAMS.cleatOffset,
    stemBase: pos.hoods, clamp: pos.hoods, headTop: pos.hoods, seatAxisTop: pos.saddle, saddleTilt: pos.saddleTilt,
  };
}

/** The report a setup on a frame would produce: what a fitter would measure on the bike as it is. */
export function reportFromSetup(frame: Frame, comp: Components, p: FitParams): FitReport {
  const L = forwardLayout(frame, comp, p);
  const t = rad(p.saddleTilt);
  const half = comp.saddleLength / 2;
  const M = { x: L.nose.x - half * Math.cos(t), y: L.nose.y - half * Math.sin(t) };
  return {
    label: '',
    saddleHeight: Math.round(Math.hypot(M.x, M.y)),
    seatAngle: round1(deg(Math.atan2(M.y, -M.x))),
    saddleSetback: Math.round(L.nose.x),
    saddleAngle: p.saddleTilt,
    gripReach: Math.round(L.hoods.x),
    gripDrop: Math.round(L.hoods.y - M.y),
    crankLength: p.crankLength,
  };
}

const uniq = (xs: number[]) => [...new Set(xs)];

/** The saddle, seatpost, stem and spacers from the part lists that put the saddle and hoods nearest a report on a frame. */
export function matchPosition(
  frame: Frame, comp: Components, pos: ReportPosition, options: PartOptions, base: FitParams,
): PositionMatch {
  const p: FitParams = { ...base, crankLength: pos.crankLength, saddleTilt: pos.saddleTilt };
  const height = pos.saddle.y / Math.sin(rad(frame.seatTubeAngle));
  p.saddleHeight = clamp(Math.round(height * 2) / 2, options.saddleHeightRange[0], options.saddleHeightRange[1]);

  const [rLo, rHi] = options.railRange;
  let chosen: { post: number; rail: number } | null = null;
  let nearest: { post: number; rail: number } | null = null;
  for (const post of uniq([base.seatpostSetback, ...options.seatpostSetbacks])) {
    const rail = railForSetback(frame, comp, { ...p, seatpostSetback: post }, -pos.nose.x);
    if (rail >= rLo && rail <= rHi) { chosen = { post, rail }; break; }
    if (!nearest || Math.abs(rail) < Math.abs(nearest.rail)) nearest = { post, rail };
  }
  const seat = chosen ?? { post: nearest!.post, rail: clamp(nearest!.rail, rLo, rHi) };
  p.seatpostSetback = seat.post;
  p.railOffset = seat.rail;

  const spacers: number[] = [];
  for (let s = 0; s <= frame.maxSpacers; s += options.spacerStep) spacers.push(s);
  if (base.spacers <= frame.maxSpacers) spacers.push(base.spacers);
  let best: { cost: number; stemLength: number; stemAngle: number; spacers: number } | null = null;
  for (const stemLength of uniq([base.stemLength, ...options.stemLengths])) {
    for (const stemAngle of uniq([base.stemAngle, ...options.stemAngles])) {
      for (const sp of uniq(spacers)) {
        const h = forwardLayout(frame, comp, { ...p, stemLength, stemAngle, spacers: sp }).hoods;
        const cost = Math.hypot(h.x - pos.hoods.x, h.y - pos.hoods.y)
          + (stemLength !== base.stemLength || stemAngle !== base.stemAngle ? 3 : 0)
          + 0.02 * Math.abs(sp - base.spacers);
        if (!best || cost < best.cost) best = { cost, stemLength, stemAngle, spacers: sp };
      }
    }
  }
  p.stemLength = best!.stemLength;
  p.stemAngle = best!.stemAngle;
  p.spacers = best!.spacers;

  const L = forwardLayout(frame, comp, p);
  return {
    params: p,
    saddleOff: { x: L.saddle.x - pos.saddle.x, y: L.saddle.y - pos.saddle.y },
    hoodsOff: { x: L.hoods.x - pos.hoods.x, y: L.hoods.y - pos.hoods.y },
  };
}

/** "12 mm higher and 5 mm further back", leaving out a direction under 2 mm. */
export function offsetText(off: Vec2): string {
  const parts: string[] = [];
  if (Math.abs(off.y) >= 2) parts.push(`${Math.round(Math.abs(off.y))} mm ${off.y > 0 ? 'higher' : 'lower'}`);
  if (Math.abs(off.x) >= 2) parts.push(`${Math.round(Math.abs(off.x))} mm further ${off.x > 0 ? 'forward' : 'back'}`);
  return parts.length ? parts.join(' and ') : 'where your fit has it';
}

const NUMBERS: (keyof FitReport)[] = [
  'saddleHeight', 'seatAngle', 'saddleSetback', 'saddleAngle', 'gripReach', 'gripDrop', 'crankLength',
];

/** A saved or shared report, or null when it is not one. */
export function validReport(x: unknown): FitReport | null {
  if (!x || typeof x !== 'object') return null;
  const d = x as Record<string, unknown>;
  if (!NUMBERS.every((k) => typeof d[k] === 'number' && Number.isFinite(d[k] as number))) return null;
  const out: Record<string, unknown> = { label: typeof d.label === 'string' ? d.label : '' };
  for (const k of NUMBERS) out[k] = d[k];
  return out as unknown as FitReport;
}

export type Fitted = { style: Style; problem: null } | { style: null; problem: 'pedal' | 'bars' };

/**
 * My fit: the Sporty bands moved to sit on the angles the rider's body makes at the report position, plus
 * bands that hold the saddle and hoods where the report has them. Null style when the body cannot ride it.
 */
export function fittedStyle(r: FitReport, seg: Segments, comp: Components, ankling: Ankling, effort: Effort): Fitted {
  const pos = reportPosition(r, comp);
  const sport = STYLES.sport;
  const ev = evaluateFit(seg, reportLayout(r, comp), makeContext(null, comp, ankling, effort), sport.poses, 36, false);
  if (ev.poses.some((p) => p.overextended)) return { style: null, problem: 'pedal' };
  if (ev.poses.some((p) => p.overreach)) return { style: null, problem: 'bars' };
  const poses: PoseTarget[] = sport.poses.map((p, i) => {
    const bands: PoseTarget['bands'] = {};
    for (const k of Object.keys(p.bands) as MetricId[]) {
      const src = p.bands[k]!;
      if (src.weight > 0 && k !== 'kneeTop') {
        const m = ev.poses[i].metrics[k];
        const half = (src.max - src.min) / 2;
        bands[k] = { ...src, min: m - half, max: m + half };
      } else bands[k] = { ...src };
    }
    if (i === 0) {
      bands.saddleOff = band('saddleOff', [0, 3]);
      bands.handOff = band('handOff', [0, 5]);
    }
    return { ...p, bands, ...(i === 0 ? { ref: { saddle: pos.saddle, hand: pos.hoods } } : {}) };
  });
  return {
    problem: null,
    style: {
      id: 'fitted', name: 'My fit', cockpit: 'dropbar', defaultEffort: 'tempo', defaultHands: 'hoods', stock: sport.stock,
      blurb: `The position from your fit report${r.label ? ` (${r.label})` : ''}: the same saddle and hoods, and the angles your body makes there.`,
      poses, position: { saddle: pos.saddle, hoods: pos.hoods, crankLength: pos.crankLength },
    },
  };
}

const MAX_INSEAM = 1050;

/** The inseam that puts the knee at 145 degrees in the report's position, mm; null when legs are measured by hand or none up to 1050 mm does. */
export function reportInseam(r: FitReport, body: Body, comp: Components, effort: Effort): number | null {
  if ([body.overrides.femur, body.overrides.tibia].some((v) => typeof v === 'number' && v > 0)) return null;
  const layout = reportLayout(r, comp);
  const ctx = makeContext(null, comp, body.ankling, effort);
  const knee = (inseam: number) => {
    const p = evaluateFit(resolveSegments({ ...body, inseam }), layout, ctx, STYLES.sport.poses, 36, false).poses[0];
    return p.overextended ? 180 : p.metrics.knee;
  };
  if (knee(MAX_INSEAM) > 145) return null;
  let lo = 500;
  let hi = MAX_INSEAM;
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2;
    if (knee(m) <= 145) hi = m;
    else lo = m;
  }
  return Math.ceil(hi / 5) * 5;
}
