import type { Evaluation, Layout, Segments } from './types';
import { add, angleBetween, deg, lawOfCosAngle, len, rotate, scale, sub, unit, type Vec2 } from './vec';

export const SOLE_ANGLE = 15;
export const CYCLE_STEPS = 36;

export function solveLeg(seg: Segments, hip: Vec2, crankLength: number, footStack: number, crankDeg: number) {
  const phi = (crankDeg * Math.PI) / 180;
  const spindle: Vec2 = { x: crankLength * Math.cos(phi), y: crankLength * Math.sin(phi) };
  const ball = add(spindle, { x: 0, y: footStack });
  const a = (SOLE_ANGLE * Math.PI) / 180;
  const ankle = add(ball, {
    x: -seg.footBack * Math.cos(a) + seg.ankleHeight * Math.sin(a),
    y: seg.footBack * Math.sin(a) + seg.ankleHeight * Math.cos(a),
  });
  const d = len(sub(ankle, hip));
  const dir = unit(sub(ankle, hip));
  if (d >= seg.femur + seg.tibia) {
    return { spindle, ball, ankle, knee: add(hip, scale(dir, seg.femur)), kneeAngle: 180, overextended: true };
  }
  const kneeAngle = lawOfCosAngle(seg.femur, seg.tibia, d);
  const beta = lawOfCosAngle(seg.femur, d, seg.tibia);
  const knee = add(hip, scale(rotate(dir, beta), seg.femur));
  return { spindle, ball, ankle, knee, kneeAngle, overextended: false };
}

export function solveUpperBody(seg: Segments, hip: Vec2, hand: Vec2, elbowPref: number) {
  const T = seg.torso;
  const u = seg.upperArm;
  const f = seg.forearmGrip;
  const g = len(sub(hand, hip));
  const Dp = Math.sqrt(u * u + f * f - 2 * u * f * Math.cos((elbowPref * Math.PI) / 180));
  let D = Math.max(Dp, g - T, T - g);
  let overreach = false;
  let shoulder: Vec2;
  const dir = unit(sub(hand, hip));
  if (D > u + f) {
    D = u + f;
    overreach = true;
    shoulder = add(hip, scale(dir, T));
  } else {
    const a = lawOfCosAngle(T, g, D);
    shoulder = add(hip, scale(rotate(dir, a), T));
  }
  const torsoAngle = deg(Math.atan2(shoulder.y - hip.y, shoulder.x - hip.x));
  const dSG = Math.min(len(sub(hand, shoulder)), u + f);
  const elbowAngle = lawOfCosAngle(u, f, dSG);
  const b = lawOfCosAngle(u, dSG, f);
  const sh = unit(sub(hand, shoulder));
  const elbow = add(shoulder, scale(rotate(sh, -b), u));
  const handDrawn = overreach ? add(shoulder, scale(sh, u + f)) : hand;
  const shoulderAngle = angleBetween(sub(hip, shoulder), sub(hand, shoulder));
  return { shoulder, elbow, handDrawn, torsoAngle, shoulderAngle, elbowAngle, overreach };
}

export interface RiderPose {
  hip: Vec2;
  knee: Vec2;
  ankle: Vec2;
  ball: Vec2;
  spindle: Vec2;
  shoulder: Vec2;
  elbow: Vec2;
  hand: Vec2;
  head: Vec2;
  kneeAngle: number;
  hipAngle: number;
  torsoAngle: number;
  shoulderAngle: number;
  elbowAngle: number;
  overextended: boolean;
  overreach: boolean;
}

export function riderPose(
  seg: Segments,
  layout: Layout,
  footStack: number,
  elbowPref: number,
  crankDeg: number,
): RiderPose {
  const hip = add(layout.saddle, { x: 0, y: seg.hipUp });
  const up = solveUpperBody(seg, hip, layout.hand, elbowPref);
  const leg = solveLeg(seg, hip, layout.crankLength, footStack, crankDeg);
  const H = seg.torso / 0.288;
  const head = add(add(up.shoulder, scale(unit(sub(up.shoulder, hip)), 0.03 * H)), { x: 0.02 * H, y: 0.03 * H });
  return {
    hip,
    knee: leg.knee,
    ankle: leg.ankle,
    ball: leg.ball,
    spindle: leg.spindle,
    shoulder: up.shoulder,
    elbow: up.elbow,
    hand: up.handDrawn,
    head,
    kneeAngle: leg.kneeAngle,
    hipAngle: angleBetween(sub(up.shoulder, hip), sub(leg.knee, hip)),
    torsoAngle: up.torsoAngle,
    shoulderAngle: up.shoulderAngle,
    elbowAngle: up.elbowAngle,
    overextended: leg.overextended,
    overreach: up.overreach,
  };
}

export function evaluateFit(seg: Segments, layout: Layout, footStack: number, elbowPref: number): Evaluation {
  // Hot path for the optimizer: scalar math, no allocation. Mirrors solveLeg.
  const hipX = layout.saddle.x;
  const hipY = layout.saddle.y + seg.hipUp;
  const up = solveUpperBody(seg, { x: hipX, y: hipY }, layout.hand, elbowPref);
  const torsoDir = Math.atan2(up.shoulder.y - hipY, up.shoulder.x - hipX);
  const sa = (SOLE_ANGLE * Math.PI) / 180;
  const ox = -seg.footBack * Math.cos(sa) + seg.ankleHeight * Math.sin(sa);
  const oy = seg.footBack * Math.sin(sa) + seg.ankleHeight * Math.cos(sa) + footStack;
  const f = seg.femur;
  const t = seg.tibia;
  const reach = f + t;
  let kneeMax = 0;
  let peak = 0;
  let hipMin = Infinity;
  let kops = 0;
  let over = false;
  for (let i = 0; i < CYCLE_STEPS; i++) {
    const phi = (360 / CYCLE_STEPS) * i;
    const pr = (phi * Math.PI) / 180;
    const sx = layout.crankLength * Math.cos(pr);
    const sy = layout.crankLength * Math.sin(pr);
    const dx = sx + ox - hipX;
    const dy = sy + oy - hipY;
    const d = Math.hypot(dx, dy);
    let kneeAngle: number;
    let beta: number;
    if (d >= reach) {
      over = true;
      kneeAngle = 180;
      beta = 0;
    } else {
      kneeAngle = lawOfCosAngle(f, t, d);
      beta = (lawOfCosAngle(f, d, t) * Math.PI) / 180;
    }
    if (kneeAngle > kneeMax) {
      kneeMax = kneeAngle;
      peak = phi;
    }
    const kneeDir = Math.atan2(dy, dx) + beta;
    let ha = Math.abs(torsoDir - kneeDir);
    if (ha > Math.PI) ha = 2 * Math.PI - ha;
    const hd = (ha * 180) / Math.PI;
    if (hd < hipMin) hipMin = hd;
    if (i === 0) kops = hipX + Math.cos(kneeDir) * f + seg.kneeFront - sx;
  }
  return {
    metrics: {
      knee: kneeMax,
      hip: hipMin,
      torso: up.torsoAngle,
      shoulder: up.shoulderAngle,
      elbow: up.elbowAngle,
      kops,
    },
    overextended: over,
    overreach: up.overreach,
    peakKneeCrank: peak,
  };
}
