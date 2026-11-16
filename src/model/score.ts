import type { Band, Evaluation, FitParams, PoseTarget, MetricId } from './types';

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
  let over = false;
  let reach = false;
  targets.forEach((t, i) => {
    const pe = ev.poses[i];
    for (const k of Object.keys(t.bands) as MetricId[]) c += weights[i] * metricCost(pe.metrics[k], t.bands[k]!);
    if (pe.overextended) over = true;
    if (pe.overreach) reach = true;
  });
  return c + (over ? 50 : 0) + (reach ? 50 : 0);
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
