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
  const headTop: Vec2 = { x: frame.reach, y: frame.stack };
  const h = steerAxis(frame);
  const stemBase = add(headTop, scale(h, p.spacers + comp.headsetCap + 20));
  const hta = rad(frame.headTubeAngle);
  const n: Vec2 = { x: Math.sin(hta), y: Math.cos(hta) };
  const clamp = add(stemBase, scale(rotate(n, p.stemAngle), p.stemLength));
  const hand = add(clamp, { x: comp.barReach + comp.hoodReach, y: comp.hoodRise });
  return { saddle, hand, crankLength: p.crankLength, stemBase, clamp, headTop, seatAxisTop };
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
