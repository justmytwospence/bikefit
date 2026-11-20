import type { Evaluation, FitParams, Layout } from './types';
import type { Level } from '../lib/appData';
import type { LinkId } from '../lib/linkIds';

export interface Readout {
  id: string;
  label: string;
  value: string;
  /** What it shows on the drawing. */
  link: LinkId;
}

export function contactReadouts(layout: Layout, params: FitParams, ev: Evaluation, level: Level): Readout[] {
  const r = Math.round;
  const out: Readout[] = [];
  if (level >= 2) {
    out.push({ id: 'saddleHeight', label: 'Saddle height', value: `${r(params.saddleHeight)} mm`, link: 'saddleHeight' });
    out.push({ id: 'setback', label: 'Setback to saddle nose', value: `${r(-layout.nose.x)} mm`, link: 'setback' });
    out.push({ id: 'reach', label: 'Saddle to bar reach', value: `${r(layout.clamp.x - layout.nose.x)} mm`, link: 'r:reach' });
    out.push({ id: 'drop', label: 'Saddle to bar drop', value: `${r(layout.saddle.y - layout.clamp.y)} mm`, link: 'r:drop' });
    out.push({ id: 'seatAngle', label: 'Seat angle', value: `${ev.poses[0].metrics.seatAngle.toFixed(1)}°`, link: 'm:seatAngle' });
    if (Number.isFinite(ev.toeClearance)) {
      const t = r(ev.toeClearance);
      out.push({ id: 'toe', label: 'Toe clearance', value: t < 0 ? `Overlap ${-t} mm` : `${t} mm`, link: 'r:toe' });
    }
  }
  if (level >= 3) {
    out.push({ id: 'hoods', label: 'Hoods from BB', value: `${r(layout.hoods.x)} mm forward, ${r(layout.hoods.y)} mm up`, link: 'r:hoods' });
  }
  return out;
}
