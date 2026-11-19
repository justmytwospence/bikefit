import { forwardLayout } from './geometry';
import { DEFAULT_PARAMS } from './presets';
import type { Band, Components, Evaluation, FitParams, Frame, PoseTarget, MetricId, StockCockpit } from './types';
import type { Vec2 } from './vec';


/**
 * The stem length a frame of this size is sold with, mm: a line through the stock stems of the Tarmac and
 * Domane size runs (70 to 110 mm) against effective top tube length (reach + stack / tan(seat angle)).
 */
export function nominalStem(frame: Frame): number {
  const ett = frame.reach + frame.stack / Math.tan((frame.seatTubeAngle * Math.PI) / 180);
  return Math.min(110, Math.max(70, 100 + 0.45 * (ett - 552)));
}

/** Cost of a build's distance from the rider's ideal hoods point: 0.15 at 20 mm, 0.6 at 40 mm. */
export const POSITION_WEIGHT = 0.15;
/** Cost of a stem 20 mm away from the frame's stock length. */
export const STEM_WEIGHT = 0.2;
/** Cost of a frame whose spacer range passes 20 mm from the rider's ideal hoods point. */
export const FRAME_WEIGHT = 0.35;
/** Cost of sitting 20 mm of spacers away from where the style normally sits in that range. */
export const HEADROOM_WEIGHT = 0.08;
/** The cockpit assumed when a problem names none: stock stem, two thirds up the spacers. */
export const DEFAULT_STOCK: StockCockpit = { spacerShare: 0.65, stemExtra: 0 };

/**
 * Where a frame can put the hoods with its stock stem (plus the style's extra) at -6 degrees: from no
 * spacers (`low`) to all of them (`high`), both relative to the rider's ideal hoods point, mm.
 * `share` is where in that range the style normally sits.
 */
export interface StockRange {
  low: Vec2;
  high: Vec2;
  share: number;
}

export function stockRange(frame: Frame, components: Components, stock: StockCockpit, ideal: Vec2): StockRange {
  const at = (spacers: number): Vec2 => {
    const h = forwardLayout(frame, components, {
      ...DEFAULT_PARAMS, stemLength: nominalStem(frame) + stock.stemExtra, stemAngle: -6, spacers,
    }).hoods;
    return { x: h.x - ideal.x, y: h.y - ideal.y };
  };
  return { low: at(0), high: at(frame.maxSpacers), share: stock.spacerShare };
}

/** The point of the range nearest the ideal point (as an offset from it) and how far up the range it is, 0 to 1. */
export function nearestOnRange(r: StockRange): { off: Vec2; t: number } {
  const dx = r.high.x - r.low.x;
  const dy = r.high.y - r.low.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, -(r.low.x * dx + r.low.y * dy) / len2));
  return { off: { x: r.low.x + t * dx, y: r.low.y + t * dy }, t };
}

/**
 * What a frame costs a rider before any parts are swapped: how far its spacer range passes from the ideal
 * hoods point, and how far along the range the rider would sit from where the style normally does.
 */
export function frameCost(r: StockRange): number {
  const { off, t } = nearestOnRange(r);
  const along = (t - r.share) * Math.hypot(r.high.x - r.low.x, r.high.y - r.low.y);
  return FRAME_WEIGHT * (Math.hypot(off.x, off.y) / 20) ** 2 + HEADROOM_WEIGHT * (along / 20) ** 2;
}
/** Added to the cost of a build that only fits with compromises, so it ranks below a clean one. */
export const COMPROMISE_COST = 0.1;

/**
 * What makes one frame or size a better choice than another once the angles are in range: how far the
 * hoods end up from the ideal point, and how far the parts are from what the frame is sold with.
 * Used for new builds only; a bike you already ride is scored on its angles.
 */
export function sizingPenalty(p: FitParams, frame: Frame, hoods: Vec2, ideal: Vec2 | undefined): number {
  let c = STEM_WEIGHT * ((p.stemLength - nominalStem(frame)) / 20) ** 2;
  const a = p.stemAngle;
  c += a >= 17 ? 0.6 : a >= 10 ? 0.3 : a >= 6 ? 0.15 : a <= -17 ? 0.3 : a === -6 ? 0 : 0.02;
  if (p.spacers > 25) c += 0.2 * ((p.spacers - 25) / 15) ** 2;
  if (ideal) c += POSITION_WEIGHT * (Math.hypot(hoods.x - ideal.x, hoods.y - ideal.y) / 20) ** 2;
  return c;
}

export function outside(v: number, band: Band): number {
  return Math.max(0, band.min - v, v - band.max);
}

export function metricCost(v: number, band: Band): number {
  if (band.weight === 0) return 0;
  const out = outside(v, band);
  const mid = (band.min + band.max) / 2;
  return (
    band.weight * (out / band.scale) ** 2 +
    band.center * band.weight * ((v - mid) / (band.max - band.min)) ** 2
  );
}

export type Status = 'ok' | 'near' | 'off' | 'info';
export function status(v: number, band: Band): Status {
  if (band.weight === 0) return 'info';
  const out = outside(v, band);
  if (out === 0) return 'ok';
  return out <= band.scale ? 'near' : 'off';
}

export function fitCost(ev: Evaluation, targets: PoseTarget[], weights: number[]): number {
  let c = 0;
  let short = -1;
  let reach = false;
  targets.forEach((t, i) => {
    const pe = ev.poses[i];
    for (const k of Object.keys(t.bands) as MetricId[]) c += weights[i] * metricCost(pe.metrics[k], t.bands[k]!);
    if (pe.overextended) short = Math.max(short, pe.legShortfall);
    if (pe.overreach) reach = true;
  });
  // The shortfall term gives the optimizer a slope back towards a reachable pedal.
  return c + (short >= 0 ? 50 + 0.5 * short : 0) + (reach ? 50 : 0);
}

export function partPenalty(p: FitParams): number {
  let c = 0;
  if (p.stemLength > 130 || p.stemLength < 70) c += 0.3;
  if (Math.abs(p.stemAngle) >= 17) c += 0.15;
  if (p.crankLength === 160) c += 0.1;
  else if (p.crankLength === 165 || p.crankLength === 175) c += 0.03;
  c += 0.00002 * (p.stemLength - 100) ** 2;
  c += 0.0004 * (p.cleatOffset - 5) ** 2;
  return c;
}

export const STEM_RISE_FLAG = 10;

/** Soft cost of builds a shop would call a compromise, so the optimizer avoids them when it can. */
export function buildPenalty(p: FitParams, maxSpacers: number): number {
  let c = 0;
  if (p.stemAngle >= STEM_RISE_FLAG) c += 0.08;
  if (maxSpacers > 0 && p.spacers >= maxSpacers) c += 0.08;
  c += 0.0002 * p.railOffset ** 2;
  return c;
}

export function changePenalty(p: FitParams, base: FitParams): number {
  let c = 0;
  if (p.stemLength !== base.stemLength || p.stemAngle !== base.stemAngle) c += 0.25;
  if (p.crankLength !== base.crankLength) c += 0.4;
  if (p.seatpostSetback !== base.seatpostSetback) c += 0.25;
  c +=
    0.00002 *
    ((p.saddleHeight - base.saddleHeight) ** 2 +
      (p.railOffset - base.railOffset) ** 2 +
      (p.spacers - base.spacers) ** 2 +
      (p.cleatOffset - base.cleatOffset) ** 2);
  return c;
}

export const fitScore = (cost: number): number => Math.round(100 * Math.exp(-cost / 2));
