import type { Band, Evaluation, FitParams, MetricId, PartOptions } from './types';

export function outside(v: number, band: Band): number {
  return Math.max(0, band.min - v, v - band.max);
}

export function metricCost(v: number, band: Band): number {
  const out = outside(v, band);
  const mid = (band.min + band.max) / 2;
  return band.weight * (out / band.scale) ** 2 + 0.05 * band.weight * ((v - mid) / (band.max - band.min)) ** 2;
}

export type Status = 'ok' | 'near' | 'off';
export function status(v: number, band: Band): Status {
  const out = outside(v, band);
  if (out === 0) return 'ok';
  return out <= band.scale ? 'near' : 'off';
}

export function evaluationCost(ev: Evaluation, bands: Record<MetricId, Band>): number {
  let c = 0;
  for (const k of Object.keys(bands) as MetricId[]) c += metricCost(ev.metrics[k], bands[k]);
  if (ev.overextended) c += 50;
  if (ev.overreach) c += 50;
  return c;
}

export function partPenalty(p: FitParams, _opts?: PartOptions): number {
  let c = 0;
  if (p.stemLength > 130 || p.stemLength < 70) c += 0.3;
  if (Math.abs(p.stemAngle) >= 17) c += 0.15;
  if (p.crankLength === 160) c += 0.1;
  else if (p.crankLength === 165 || p.crankLength === 175) c += 0.03;
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
      (p.spacers - base.spacers) ** 2);
  return c;
}

export const fitScore = (cost: number): number => Math.round(100 * Math.exp(-cost / 2));
