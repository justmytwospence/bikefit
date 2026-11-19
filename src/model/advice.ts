import type { FitProblem, FitResult } from './optimize';
import { outside } from './score';
import { METRIC_LABELS, METRIC_ORDER } from './styles';
import type { FitParams, MetricId, ParamKey } from './types';

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

export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
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
