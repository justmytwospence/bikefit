import type { Components, FitParams, Frame, Layout } from './types';
import { add, rad, rotate, scale, sub, type Vec2 } from './vec';

const seatAxis = (frame: Frame): Vec2 => ({
  x: -Math.cos(rad(frame.seatTubeAngle)),
  y: Math.sin(rad(frame.seatTubeAngle)),
});
const steerAxis = (frame: Frame): Vec2 => ({
  x: -Math.cos(rad(frame.headTubeAngle)),
  y: Math.sin(rad(frame.headTubeAngle)),
});

export function forwardLayout(frame: Frame, comp: Components, p: FitParams): Layout {
  const seatAxisTop = scale(seatAxis(frame), p.saddleHeight);
  const saddle = add(seatAxisTop, { x: p.railOffset - p.seatpostSetback, y: 0 });
  const tilt = p.saddleTilt ?? 0;
  const roll = p.barRoll ?? 0;
  const noseLen = comp.saddleLength - 120;
  const nose: Vec2 = {
    x: saddle.x + noseLen * Math.cos(rad(tilt)),
    y: saddle.y + noseLen * Math.sin(rad(tilt)),
  };
  const headTop: Vec2 = { x: frame.reach, y: frame.stack };
  const h = steerAxis(frame);
  const stemBase = add(headTop, scale(h, p.spacers + comp.headsetCap + 20));
  const hta = rad(frame.headTubeAngle);
  const n: Vec2 = { x: Math.sin(hta), y: Math.cos(hta) };
  const clamp = add(stemBase, scale(rotate(n, p.stemAngle), p.stemLength));
  const hoods = add(clamp, rotate({ x: comp.barReach + comp.hoodReach, y: comp.hoodRise }, roll));
  const drops = add(clamp, rotate({ x: comp.barReach - 40, y: -comp.barDrop + 15 }, roll));
  return {
    saddle, nose, hoods, drops, crankLength: p.crankLength, cleatOffset: p.cleatOffset,
    stemBase, clamp, headTop, seatAxisTop, saddleTilt: tilt, barRoll: roll,
  };
}

export function dropsFromHoods(hoods: Vec2, comp: Components): Vec2 {
  return add(hoods, { x: -40 - comp.hoodReach, y: -comp.barDrop + 15 - comp.hoodRise });
}

/** Distance the saddle nose sits behind the bottom bracket. */
export function noseSetback(frame: Frame, comp: Components, p: FitParams): number {
  return -forwardLayout(frame, comp, p).nose.x;
}

export function railForSetback(frame: Frame, comp: Components, p: FitParams, setback: number): number {
  const L0 = forwardLayout(frame, comp, { ...p, railOffset: 0 });
  return Math.round((-setback - L0.nose.x) * 2) / 2;
}

export function setbackRange(
  frame: Frame, comp: Components, p: FitParams, railRange: [number, number],
): [number, number] {
  const L0 = forwardLayout(frame, comp, { ...p, railOffset: 0 });
  return [-(L0.nose.x + railRange[1]), -(L0.nose.x + railRange[0])];
}

export function frameSkeleton(frame: Frame) {
  const s = seatAxis(frame);
  const h = steerAxis(frame);
  const headTop: Vec2 = { x: frame.reach, y: frame.stack };
  const rearX = -Math.sqrt(Math.max(0, frame.chainstay ** 2 - frame.bbDrop ** 2));
  const rearAxle: Vec2 = { x: rearX, y: frame.bbDrop };
  return {
    bb: { x: 0, y: 0 },
    rearAxle,
    frontAxle: { x: frame.wheelbase + rearX, y: frame.bbDrop },
    seatCluster: scale(s, frame.seatTubeLength),
    headTop,
    headBottom: sub(headTop, scale(h, frame.headTubeLength)),
  };
}

export { steerAxis, seatAxis };
