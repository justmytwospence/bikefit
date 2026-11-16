import type { Segments } from '../model/types';
import { add, len, scale, sub, type Vec2 } from '../model/vec';

const RAD = Math.PI / 180;
const f = (n: number) => (Math.round(n * 10) / 10).toString();

export function polyPath(pts: Vec2[]): string {
  return 'M ' + pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ') + ' Z';
}

/** Tapered limb: circles of radius ra at a and rb at b joined by their outer tangents. */
export function capsulePoints(a: Vec2, b: Vec2, ra: number, rb: number, seg = 10): Vec2[] {
  const d = len(sub(b, a));
  if (d < 1e-6 || d <= Math.abs(ra - rb)) {
    const c = ra >= rb ? a : b;
    const r = Math.max(ra, rb);
    return Array.from({ length: 2 * seg }, (_, i) => {
      const t = (i / (2 * seg)) * 2 * Math.PI;
      return { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) };
    });
  }
  const psi = Math.atan2(b.y - a.y, b.x - a.x);
  const phi = Math.asin((ra - rb) / d);
  const pts: Vec2[] = [];
  const b0 = psi - Math.PI / 2 + phi;
  const b1 = psi + Math.PI / 2 - phi;
  for (let i = 0; i <= seg; i++) {
    const t = b0 + ((b1 - b0) * i) / seg;
    pts.push({ x: b.x + rb * Math.cos(t), y: b.y + rb * Math.sin(t) });
  }
  const a1 = psi + (3 * Math.PI) / 2 + phi;
  for (let i = 0; i <= seg; i++) {
    const t = b1 + ((a1 - b1) * i) / seg;
    pts.push({ x: a.x + ra * Math.cos(t), y: a.y + ra * Math.sin(t) });
  }
  return pts;
}
export const capsulePath = (a: Vec2, b: Vec2, ra: number, rb: number, seg?: number): string =>
  polyPath(capsulePoints(a, b, ra, rb, seg));

/** Closed Catmull-Rom spline through the points, as cubic Beziers. */
export function smoothClosedPath(pts: Vec2[], tension = 1): string {
  const n = pts.length;
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += ` C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d + ' Z';
}

export interface FootFrame {
  o: Vec2;
  u: Vec2;
  n: Vec2;
}
/** Origin at the ball of the foot, u forward along the sole, n up from it. */
export function footFrame(ball: Vec2, soleDeg: number): FootFrame {
  const a = soleDeg * RAD;
  return { o: ball, u: { x: Math.cos(a), y: -Math.sin(a) }, n: { x: Math.sin(a), y: Math.cos(a) } };
}
export const toWorld = (fr: FootFrame, p: Vec2): Vec2 =>
  add(fr.o, add(scale(fr.u, p.x), scale(fr.n, p.y)));

export const SOLE_T = 7;
export const PEDAL_HALF = 8;

/** Shoe, cleat and pedal in the foot frame (x forward along the sole from the ball, y up). */
export function shoeLocal(seg: Segments, footStack: number, cleatOffset: number) {
  const FL = seg.footLength;
  const a = seg.ankleHeight;
  const heel = -0.72 * FL - 12;
  const toe = seg.toeAhead;
  const sb = -SOLE_T;
  const outline: Vec2[] = [
    { x: heel + 14, y: sb },
    { x: toe - 30, y: sb },
    { x: toe, y: sb + 14 },
    { x: toe - 14, y: 34 },
    { x: toe - 70, y: 48 },
    { x: -0.3 * FL, y: 0.62 * a + 22 },
    { x: -seg.footBack + 30, y: a + 18 },
    { x: -seg.footBack - 22, y: a + 22 },
    { x: heel + 4, y: a - 6 },
    { x: heel, y: 26 },
    { x: heel + 4, y: sb + 6 },
  ];
  const sole: Vec2[] = [
    { x: heel + 16, y: sb },
    { x: toe - 32, y: sb },
    { x: toe - 24, y: sb + 5 },
    { x: heel + 18, y: sb + 5 },
  ];
  const cleatBottom = Math.min(sb - 3, -footStack + PEDAL_HALF);
  const cx = -cleatOffset;
  const cleat: Vec2[] = [
    { x: cx - 39, y: sb },
    { x: cx + 39, y: sb },
    { x: cx + 32, y: cleatBottom },
    { x: cx - 32, y: cleatBottom },
  ];
  const pedal: Vec2[] = [
    { x: cx - 44, y: -footStack + PEDAL_HALF },
    { x: cx + 42, y: -footStack + PEDAL_HALF },
    { x: cx + 46, y: -footStack - PEDAL_HALF },
    { x: cx - 40, y: -footStack - PEDAL_HALF - 2 },
  ];
  return {
    outline, sole, cleat, pedal, heel, toe,
    spindle: { x: cx, y: -footStack } as Vec2,
    ballMark: { x: 0, y: sb } as Vec2,
  };
}

export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const L2 = ab.x * ab.x + ab.y * ab.y;
  const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / L2));
  return len(sub(p, add(a, scale(ab, t))));
}

export interface Obstacle {
  a: Vec2;
  b: Vec2;
  r: number;
}
/** Walks a label outward from the centre along the angle until it clears every limb. */
export function placeLabel(
  center: Vec2, angleDeg: number, r0: number, obstacles: Obstacle[], clearance = 34, step = 24, maxSteps = 8,
): Vec2 {
  const dir = { x: Math.cos(angleDeg * RAD), y: Math.sin(angleDeg * RAD) };
  for (let i = 0; i <= maxSteps; i++) {
    const p = add(center, scale(dir, r0 + i * step));
    if (obstacles.every((o) => distToSegment(p, o.a, o.b) > o.r + clearance)) return p;
  }
  return add(center, scale(dir, r0 + maxSteps * step));
}

/** Dimension line between a and b, offset sideways (positive = left of a to b). */
export function dimension(a: Vec2, b: Vec2, offset: number, tick = 16) {
  const d = len(sub(b, a)) || 1;
  const u = { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
  const n = { x: -u.y, y: u.x };
  const a2 = add(a, scale(n, offset));
  const b2 = add(b, scale(n, offset));
  const sg = Math.sign(offset) || 1;
  return {
    a: a2,
    b: b2,
    ticks: [
      [add(a2, scale(n, tick)), add(a2, scale(n, -tick))],
      [add(b2, scale(n, tick)), add(b2, scale(n, -tick))],
    ] as [Vec2, Vec2][],
    ext: [
      [a, add(a2, scale(n, sg * tick))],
      [b, add(b2, scale(n, sg * tick))],
    ] as [Vec2, Vec2][],
    mid: add(scale(add(a2, b2), 0.5), scale(n, sg * 30)),
  };
}

export function riderRadii(H: number) {
  return {
    pelvis: 0.042 * H,
    torsoHip: 0.04 * H,
    torsoShoulder: 0.034 * H,
    thighHip: 0.034 * H,
    thighKnee: 0.022 * H,
    shinKnee: 0.021 * H,
    shinAnkle: 0.013 * H,
    upperArmShoulder: 0.019 * H,
    upperArmElbow: 0.014 * H,
    forearmElbow: 0.013 * H,
    forearmWrist: 0.009 * H,
    hand: 0.012 * H,
    neck: 0.017 * H,
    head: 0.05 * H,
  };
}
export type Radii = ReturnType<typeof riderRadii>;

export function helmetPoints(c: Vec2, r: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let a = 5; a <= 200; a += 15) {
    pts.push({ x: c.x + (r + 12) * Math.cos(a * RAD), y: c.y + (r + 12) * Math.sin(a * RAD) });
  }
  pts.push({ x: c.x - r * 0.95, y: c.y - r * 0.2 });
  pts.push({ x: c.x + r * 0.9, y: c.y + r * 0.05 });
  return pts;
}

export function saddlePoints(s: Vec2, nose: Vec2): Vec2[] {
  const rear = s.x - 120;
  return [
    { x: rear, y: s.y + 6 }, { x: rear + 30, y: s.y + 16 }, { x: s.x + 10, y: s.y + 12 },
    { x: nose.x - 70, y: s.y + 6 }, { x: nose.x, y: s.y + 8 }, { x: nose.x - 6, y: s.y - 6 },
    { x: nose.x - 80, y: s.y - 8 }, { x: rear + 40, y: s.y - 16 }, { x: rear + 4, y: s.y - 10 },
  ];
}

export function seatpostHead(seatAxisTop: Vec2, seatTubeAngle: number, seatpostSetback: number) {
  const s = { x: -Math.cos(seatTubeAngle * RAD), y: Math.sin(seatTubeAngle * RAD) };
  const postTop = add(seatAxisTop, scale(s, -42));
  return { postTop, head: { x: postTop.x - seatpostSetback, y: postTop.y + 6 } };
}

export function barPath(clamp: Vec2, reach: number, drop: number): string {
  const R = reach;
  const D = drop;
  return `M ${clamp.x} ${clamp.y} L ${clamp.x + R - 30} ${clamp.y} Q ${clamp.x + R + 12} ${clamp.y} ${clamp.x + R + 8} ${clamp.y - 55} Q ${clamp.x + R} ${clamp.y - D} ${clamp.x + R - 70} ${clamp.y - D + 12}`;
}

export function hoodPoints(clamp: Vec2, hoods: Vec2, reach: number): Vec2[] {
  const hb = { x: clamp.x + reach - 6, y: clamp.y };
  return [
    { x: hb.x - 8, y: hb.y - 12 }, { x: hb.x + 10, y: hb.y + 2 }, { x: hoods.x + 6, y: hoods.y + 4 },
    { x: hoods.x + 22, y: hoods.y + 26 }, { x: hoods.x + 6, y: hoods.y + 16 },
    { x: hoods.x - 34, y: hoods.y + 6 }, { x: hb.x - 18, y: hb.y + 6 },
  ];
}

export function leverPath(clamp: Vec2, reach: number, drop: number): string {
  const hb = { x: clamp.x + reach - 6, y: clamp.y };
  return `M ${hb.x + 12} ${hb.y - 4} Q ${hb.x + 34} ${hb.y - 60} ${hb.x + 8} ${clamp.y - drop + 40}`;
}

export function forkPath(headBottom: Vec2, frontAxle: Vec2, steer: Vec2): string {
  const Lf = (headBottom.y - frontAxle.y) / steer.y;
  const crown = sub(headBottom, scale(steer, 0.15 * Lf));
  const ctrl = sub(headBottom, scale(steer, 0.8 * Lf));
  return `M ${f(headBottom.x)} ${f(headBottom.y)} L ${f(crown.x)} ${f(crown.y)} Q ${f(ctrl.x)} ${f(ctrl.y)} ${f(frontAxle.x)} ${f(frontAxle.y)}`;
}
