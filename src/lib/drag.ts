import { noseSetback, railForSetback } from '../model/geometry';
import type { Components, FitParams, Frame, PartOptions } from '../model/types';
import { clamp, deg, rad, rotate, type Vec2 } from '../model/vec';

const half = (n: number) => Math.round(n * 2) / 2;

/**
 * Saddle height and rail position after the saddle moves by `d` mm on the drawing (x forward, y up): up and
 * down slides along the seat tube, forward and back changes the setback to the nose.
 */
export function saddleDrag(
  start: FitParams, d: Vec2, frame: Frame, comp: Components, o: PartOptions,
): Pick<FitParams, 'saddleHeight' | 'railOffset'> {
  const saddleHeight = clamp(half(start.saddleHeight + d.y / Math.sin(rad(frame.seatTubeAngle))), o.saddleHeightRange[0], o.saddleHeightRange[1]);
  const setback = noseSetback(frame, comp, start) - d.x;
  const railOffset = clamp(railForSetback(frame, comp, { ...start, saddleHeight }, setback), o.railRange[0], o.railRange[1]);
  return { saddleHeight, railOffset };
}

/**
 * Spacers and stem length after the bar clamp moves by `d` mm: up and down adds or removes spacers along the
 * steerer (in the steps a shop has), what is left sideways picks the nearest stem length on offer.
 */
export function barsDrag(
  start: FitParams, d: Vec2, frame: Frame, o: PartOptions,
): Pick<FitParams, 'spacers' | 'stemLength'> {
  const hta = rad(frame.headTubeAngle);
  const ds = d.y / Math.sin(hta);
  const step = o.spacerStep;
  const spacers = clamp(Math.round((start.spacers + ds) / step) * step, 0, frame.maxSpacers);
  const dir = rotate({ x: Math.sin(hta), y: Math.cos(hta) }, start.stemAngle);
  const want = start.stemLength + (d.x + Math.cos(hta) * (spacers - start.spacers)) / Math.max(0.5, dir.x);
  let stemLength = start.stemLength;
  for (const n of o.stemLengths) if (Math.abs(n - want) < Math.abs(stemLength - want)) stemLength = n;
  return { spacers, stemLength };
}

/** The crank angle, degrees from forward and counterclockwise, of a point relative to the bottom bracket. */
export const crankAngle = (p: Vec2): number => (((deg(Math.atan2(p.y, p.x)) % 360) + 360) % 360);
