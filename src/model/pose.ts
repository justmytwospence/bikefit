import { soleAngle } from './riding';
import type {
  Evaluation, FitContext, HandContact, Layout, PoseEval, PoseTarget, Segments,
} from './types';
import { add, angleBetween, clamp, deg, lawOfCosAngle, len, rotate, scale, sub, unit, type Vec2 } from './vec';

export const CYCLE_STEPS = 36;
export const PELVIS_TORSO_REF = 55;
/** Anterior pelvic tilt, degrees, at the reference torso angle (Sauer 2007: 21 to 24 on the drops). */
export const PELVIS_BASE_TILT = 12;
/** Soft tissue and saddle padding between the sit bones and the saddle-top reference, mm. */
export const SEAT_TISSUE = 20;
/** How far the sit bones rest behind the saddle reference point (120 mm from the tail), mm. */
export const SIT_BACK = 40;
const RAD = Math.PI / 180;

export function solveFoot(seg: Segments, spindle: Vec2, soleDeg: number, footStack: number, cleatOffset: number) {
  const u: Vec2 = { x: Math.cos(soleDeg * RAD), y: -Math.sin(soleDeg * RAD) };
  const n: Vec2 = { x: Math.sin(soleDeg * RAD), y: Math.cos(soleDeg * RAD) };
  const ball = add(add(spindle, scale(n, footStack)), scale(u, cleatOffset));
  const ankle = add(add(ball, scale(u, -seg.footBack)), scale(n, seg.ankleHeight));
  const toe = add(ball, scale(u, seg.toeAhead));
  return { ball, ankle, toe };
}

/**
 * Sole angle a rider falls back on when the leg cannot reach with their usual one: toes pointed, as anyone
 * does to stay on a pedal that is a little too far away. Never flatter than the usual angle.
 */
export function reachingSole(ankling: FitContext['ankling'], phiDeg: number): number {
  return Math.max(soleAngle(ankling, phiDeg), soleAngle('toePoint', phiDeg));
}

export function solveLeg(seg: Segments, hip: Vec2, layout: Layout, ctx: FitContext, crankDeg: number) {
  const phi = crankDeg * RAD;
  const spindle: Vec2 = { x: layout.crankLength * Math.cos(phi), y: layout.crankLength * Math.sin(phi) };
  let soleDeg = soleAngle(ctx.ankling, crankDeg);
  let { ball, ankle, toe } = solveFoot(seg, spindle, soleDeg, ctx.footStack, layout.cleatOffset);
  if (len(sub(ankle, hip)) >= seg.femur + seg.tibia) {
    soleDeg = reachingSole(ctx.ankling, crankDeg);
    ({ ball, ankle, toe } = solveFoot(seg, spindle, soleDeg, ctx.footStack, layout.cleatOffset));
  }
  const d = len(sub(ankle, hip));
  const dir = unit(sub(ankle, hip));
  if (d >= seg.femur + seg.tibia) {
    return { spindle, ball, ankle, toe, soleDeg, knee: add(hip, scale(dir, seg.femur)), kneeAngle: 180, overextended: true };
  }
  const kneeAngle = lawOfCosAngle(seg.femur, seg.tibia, d);
  const beta = lawOfCosAngle(seg.femur, d, seg.tibia);
  const knee = add(hip, scale(rotate(dir, beta), seg.femur));
  return { spindle, ball, ankle, toe, soleDeg, knee, kneeAngle, overextended: false };
}

export function solveUpperBody(seg: Segments, hip: Vec2, hand: Vec2, elbowPref: number) {
  const T = seg.torso;
  const u = seg.upperArm;
  const f = seg.forearmGrip;
  const g = len(sub(hand, hip));
  const Dp = Math.sqrt(u * u + f * f - 2 * u * f * Math.cos(elbowPref * RAD));
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

/** The hip joint sits above the sit bones, tipped forward as the torso gets lower. */
export function solvePelvis(seg: Segments, saddle: Vec2, hand: Vec2, elbowPref: number) {
  const hipAt = (tiltDeg: number): Vec2 => {
    const t = tiltDeg * RAD;
    return {
      x: saddle.x - SIT_BACK + seg.pelvisFwd * Math.cos(t) + seg.pelvisUp * Math.sin(t),
      y: saddle.y + SEAT_TISSUE + seg.pelvisUp * Math.cos(t) - seg.pelvisFwd * Math.sin(t),
    };
  };
  let tilt = PELVIS_BASE_TILT;
  let hip = hipAt(tilt);
  let up = solveUpperBody(seg, hip, hand, elbowPref);
  for (let i = 0; i < 4; i++) {
    hip = hipAt(tilt);
    up = solveUpperBody(seg, hip, hand, elbowPref);
    if (i === 3) break; // hip and up now match the tilt we report
    tilt = clamp(PELVIS_BASE_TILT + seg.pelvicShare * (PELVIS_TORSO_REF - up.torsoAngle), 0, 40);
  }
  return { hip, up, tilt };
}

export interface RiderPose {
  hip: Vec2;
  knee: Vec2;
  ankle: Vec2;
  ball: Vec2;
  toe: Vec2;
  spindle: Vec2;
  shoulder: Vec2;
  elbow: Vec2;
  hand: Vec2;
  head: Vec2;
  contact: HandContact;
  soleDeg: number;
  crankDeg: number;
  pelvicTilt: number;
  kneeAngle: number;
  hipAngle: number;
  torsoAngle: number;
  shoulderAngle: number;
  elbowAngle: number;
  overextended: boolean;
  overreach: boolean;
}

export function riderPose(
  seg: Segments, layout: Layout, ctx: FitContext, contact: HandContact, elbowPref: number, crankDeg: number,
): RiderPose {
  const { hip, up, tilt } = solvePelvis(seg, layout.saddle, layout[contact], elbowPref);
  const leg = solveLeg(seg, hip, layout, ctx, crankDeg);
  const H = seg.torso / 0.288;
  const head = add(add(up.shoulder, scale(unit(sub(up.shoulder, hip)), 0.03 * H)), { x: 0.02 * H, y: 0.03 * H });
  return {
    hip, knee: leg.knee, ankle: leg.ankle, ball: leg.ball, toe: leg.toe, spindle: leg.spindle,
    shoulder: up.shoulder, elbow: up.elbow, hand: up.handDrawn, head, contact, soleDeg: leg.soleDeg, crankDeg, pelvicTilt: tilt,
    kneeAngle: leg.kneeAngle,
    hipAngle: angleBetween(sub(up.shoulder, hip), sub(leg.knee, hip)),
    torsoAngle: up.torsoAngle, shoulderAngle: up.shoulderAngle, elbowAngle: up.elbowAngle,
    overextended: leg.overextended, overreach: up.overreach,
  };
}

/** Hot path for the optimizer: scalar math, no per-sample allocation. */
function evaluatePose(
  seg: Segments, layout: Layout, ctx: FitContext, target: PoseTarget, steps: number,
): { ev: PoseEval; peak: number } {
  const hand = layout[target.handContact];
  const { hip, up, tilt } = solvePelvis(seg, layout.saddle, hand, target.elbowPref);
  const hipX = hip.x;
  const hipY = hip.y;
  const torsoDir = Math.atan2(up.shoulder.y - hipY, up.shoulder.x - hipX);
  const f = seg.femur;
  const t = seg.tibia;
  const reach = f + t;
  const crank = layout.crankLength;
  const cleat = layout.cleatOffset;
  const fs = ctx.footStack;
  let kneeMax = 0;
  let kneeMin = 999;
  let peak = 0;
  let top = 0;
  let hipPeak = 0;
  let hipMin = Infinity;
  let kops = 0;
  let over = false;
  let short = 0;
  let legMx = 0;
  for (let i = 0; i < steps; i++) {
    const phi = (360 / steps) * i;
    const pr = phi * RAD;
    const sx = crank * Math.cos(pr);
    const sy = crank * Math.sin(pr);
    // Usual sole angle first; out of reach, the rider points their toes (reachingSole).
    let bx = 0, ax = 0, dx = 0, dy = 0, d = 0;
    for (const sole of [soleAngle(ctx.ankling, phi), reachingSole(ctx.ankling, phi)]) {
      const a = sole * RAD;
      const ux = Math.cos(a);
      const uy = -Math.sin(a);
      const nx = Math.sin(a);
      const ny = Math.cos(a);
      bx = sx + nx * fs + ux * cleat;
      const by = sy + ny * fs + uy * cleat;
      ax = bx - ux * seg.footBack + nx * seg.ankleHeight;
      const ay = by - uy * seg.footBack + ny * seg.ankleHeight;
      dx = ax - hipX;
      dy = ay - hipY;
      d = Math.hypot(dx, dy);
      if (d < reach) break;
    }
    let kneeAngle: number;
    let beta: number;
    if (d >= reach) {
      over = true;
      if (d - reach > short) short = d - reach;
      kneeAngle = 180;
      beta = 0;
    } else {
      kneeAngle = lawOfCosAngle(f, t, d);
      beta = lawOfCosAngle(f, d, t) * RAD;
    }
    if (kneeAngle > kneeMax) {
      kneeMax = kneeAngle;
      peak = phi;
    }
    if (kneeAngle < kneeMin) {
      kneeMin = kneeAngle;
      top = phi;
    }
    const kneeDir = Math.atan2(dy, dx) + beta;
    const kx = hipX + Math.cos(kneeDir) * f;
    let ha = Math.abs(torsoDir - kneeDir);
    if (ha > Math.PI) ha = 2 * Math.PI - ha;
    const hd = (ha * 180) / Math.PI;
    if (hd < hipMin) {
      hipMin = hd;
      hipPeak = phi;
    }
    if (i === 0) kops = kx + seg.kneeFront - sx;
    legMx +=
      (2 * 0.1 * (hipX + 0.433 * (kx - hipX)) +
        2 * 0.0465 * (kx + 0.433 * (ax - kx)) +
        (2 * 0.0145 * (ax + bx)) / 2) / steps;
  }
  // Whole-body centre of mass (x only) and the share of weight on the hands.
  const H = seg.torso / 0.288;
  const S = up.shoulder;
  const E = up.elbow;
  const su = unit(sub(S, hip));
  const mx =
    0.497 * (hipX + 0.5 * (S.x - hipX)) +
    0.081 * (S.x + su.x * 0.1 * H) +
    0.056 * (S.x + 0.436 * (E.x - S.x)) +
    0.044 * (E.x + 0.6 * (hand.x - E.x));
  const comX = (mx + legMx) / (0.678 + 0.322);
  const omega = (90 * 2 * Math.PI) / 60;
  const Fp = ctx.wkg / (omega * (crank / 1000) * 9.81);
  const xp = 0.64 * crank;
  const xs = layout.saddle.x;
  const handLoad = (Math.max(0, comX - xs - Fp * (xp - xs)) / (hand.x - xs)) * 100;
  const seatAngle = deg(Math.atan2(layout.saddle.y, -layout.saddle.x));
  return {
    peak,
    ev: {
      contact: target.handContact,
      metrics: {
        knee: kneeMax, kneeTop: kneeMin, hip: hipMin, torso: up.torsoAngle, shoulder: up.shoulderAngle,
        elbow: up.elbowAngle, seatAngle, handLoad, kops,
      },
      overextended: over,
      kneeTopCrank: top,
      hipCrank: hipPeak,
      legShortfall: short,
      overreach: up.overreach,
      pelvicTilt: tilt,
      comX,
    },
  };
}

export function toeClearance(seg: Segments, layout: Layout, ctx: FitContext): number {
  if (!ctx.frontAxle) return Infinity;
  let min = Infinity;
  for (let phi = -40; phi <= 40; phi += 5) {
    const pr = phi * RAD;
    const spindle = { x: layout.crankLength * Math.cos(pr), y: layout.crankLength * Math.sin(pr) };
    const { toe } = solveFoot(seg, spindle, soleAngle(ctx.ankling, phi), ctx.footStack, layout.cleatOffset);
    min = Math.min(min, len(sub(toe, ctx.frontAxle)) - ctx.wheelRadius);
  }
  return min;
}

export function evaluateFit(
  seg: Segments, layout: Layout, ctx: FitContext, targets: PoseTarget[], steps = CYCLE_STEPS, withToe = true,
): Evaluation {
  const poses: PoseEval[] = [];
  let peakKneeCrank = 0;
  targets.forEach((t, i) => {
    const r = evaluatePose(seg, layout, ctx, t, steps);
    poses.push(r.ev);
    if (i === 0) peakKneeCrank = r.peak;
  });
  return { poses, peakKneeCrank, toeClearance: withToe ? toeClearance(seg, layout, ctx) : Infinity };
}
