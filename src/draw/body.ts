import type { RiderPose } from '../model/pose';
import type { Sex } from '../model/types';
import { add, rad, scale, sub, unit, len, type Vec2 } from '../model/vec';
import profiles from './bodyProfiles.json';
import { capsulePoints } from './shapes';

export interface Profile {
  range: [number, number];
  front: number[];
  back: number[];
  lengthOverH: number;
}
export interface SexProfiles {
  thigh: Profile;
  calf: Profile;
  upperArm: Profile;
  forearm: Profile;
  torso: Profile;
  head: Profile;
  neckBase: [number, number];
  headRestLeanDeg: number;
}
export type Segment = 'thigh' | 'calf' | 'upperArm' | 'forearm' | 'torso' | 'head';
export interface ArtBody {
  sex: Sex;
  height: number;
}

export const PROFILES = profiles as unknown as Record<Sex, SexProfiles> & {
  stations: number;
  source: { license: string };
};

export const HEAD_PITCH = 0.2;
export const WRIST_BACK = 0.045;
export const FIST_R: [number, number] = [0.022, 0.026];
export const JERSEY: [number, number] = [0.3, 1.1];
export const SLEEVE: [number, number] = [0, 0.42];
export const KIT_PAD = 0.002;
export const SEAT_T = { torso: 0.2, thigh: 0.3 };
export const HELMET = { t: 0.8, pad: 12, extraA: 12 };
export const SADDLE_FLOOR = 4;
export const TENSION = 0.6;

const rot = (v: Vec2, deg: number): Vec2 => {
  const t = rad(deg);
  return { x: v.x * Math.cos(t) - v.y * Math.sin(t), y: v.x * Math.sin(t) + v.y * Math.cos(t) };
};

/** A sub-range of a profile, resampled to n stations, with its outline padded outward by `pad` (x height). */
export function subProfile(p: Profile, from: number, to: number, pad = 0, n = 13): Profile {
  const [lo, hi] = p.range;
  const N = p.front.length;
  const val = (arr: number[], t: number) => {
    const x = ((t - lo) / (hi - lo)) * (N - 1);
    const i = Math.max(0, Math.min(N - 2, Math.floor(x)));
    const f = x - i;
    return arr[i] * (1 - f) + arr[i + 1] * f;
  };
  const front: number[] = [];
  const back: number[] = [];
  for (let k = 0; k < n; k++) {
    const t = from + ((to - from) * k) / (n - 1);
    front.push(val(p.front, t) + pad);
    back.push(val(p.back, t) - pad);
  }
  return { range: [from, to], front, back, lengthOverH: p.lengthOverH };
}

/** Outline of a body segment laid along A to B. `side` +1 puts the front on the left of A to B. */
export function segmentOutline(p: Profile, A: Vec2, B: Vec2, H: number, side: 1 | -1, caps: boolean): Vec2[] {
  const d0 = sub(B, A);
  const L = len(d0);
  const d = scale(d0, 1 / L);
  const n = rot(d, side * 90);
  const [lo, hi] = p.range;
  const N = p.front.length;
  const F: Vec2[] = [];
  const Bk: Vec2[] = [];
  for (let i = 0; i < N; i++) {
    const c = add(A, scale(d, (lo + ((hi - lo) * i) / (N - 1)) * L));
    F.push(add(c, scale(n, p.front[i] * H)));
    Bk.push(add(c, scale(n, p.back[i] * H)));
  }
  const cap = (fp: Vec2, bp: Vec2, dir: Vec2): Vec2[] => {
    const m = scale(add(fp, bp), 0.5);
    const r = len(sub(fp, bp)) / 2;
    const u = r > 0 ? scale(sub(fp, m), 1 / r) : { x: 0, y: 0 };
    const out: Vec2[] = [];
    for (let k = 1; k < 8; k++) {
      const a = (k / 8) * Math.PI;
      out.push(add(m, add(scale(u, r * Math.cos(a)), scale(dir, r * Math.sin(a)))));
    }
    return out;
  };
  const pts = [...F];
  if (caps) pts.push(...cap(F[N - 1], Bk[N - 1], d));
  const rev = [...Bk].reverse();
  pts.push(...rev);
  if (caps) pts.push(...cap(Bk[0], F[0], scale(d, -1)));
  return pts;
}

export function convexHull(input: Vec2[]): Vec2[] {
  const P = [...input].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Vec2[] = [];
  const up: Vec2[] = [];
  for (const p of P) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (const p of [...P].reverse()) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** Flattens the underside of the rider onto the saddle top. */
export function floorToSaddle(pts: Vec2[], saddle: Vec2, nose: Vec2): Vec2[] {
  const floor = saddle.y + SADDLE_FLOOR;
  return pts.map((p) => (p.x >= saddle.x - 140 && p.x <= nose.x && p.y < floor ? { x: p.x, y: floor } : p));
}

/** Half the largest front-to-back depth of a segment, mm. */
export function halfDepth(sex: Sex, seg: Segment, H: number): number {
  const p = PROFILES[sex][seg];
  let m = 0;
  for (let i = 0; i < p.front.length; i++) m = Math.max(m, p.front[i] - p.back[i]);
  return (m / 2) * H;
}

const axial = (q: Vec2, A: Vec2, d: Vec2, L2: number) => ((q.x - A.x) * d.x + (q.y - A.y) * d.y) / L2;

export function legArt(pose: RiderPose, body: ArtBody, saddle: Vec2, nose: Vec2) {
  const P = PROFILES[body.sex];
  const H = body.height;
  // only the top of the thigh rests on the saddle; the rest of it hangs below saddle height
  const raw = segmentOutline(P.thigh, pose.hip, pose.knee, H, 1, true);
  const kd = sub(pose.knee, pose.hip);
  const kl2 = kd.x * kd.x + kd.y * kd.y;
  const floored = floorToSaddle(raw, saddle, nose);
  const thigh = raw.map((q, i) => (axial(q, pose.hip, kd, kl2) <= SEAT_T.thigh ? floored[i] : q));
  return {
    thigh,
    calf: segmentOutline(P.calf, pose.knee, pose.ankle, H, 1, true),
  };
}

export function torsoArt(pose: RiderPose, body: ArtBody, saddle: Vec2, nose: Vec2) {
  const P = PROFILES[body.sex];
  const H = body.height;
  const rawTorso = segmentOutline(P.torso, pose.hip, pose.shoulder, H, -1, false);
  const rawThigh = segmentOutline(P.thigh, pose.hip, pose.knee, H, 1, true);
  const td = sub(pose.shoulder, pose.hip);
  const tl2 = td.x * td.x + td.y * td.y;
  const kd = sub(pose.knee, pose.hip);
  const kl2 = kd.x * kd.x + kd.y * kd.y;
  const seat = floorToSaddle(
    convexHull([
      ...rawTorso.filter((q) => axial(q, pose.hip, td, tl2) <= SEAT_T.torso),
      ...rawThigh.filter((q) => axial(q, pose.hip, kd, kl2) <= SEAT_T.thigh),
    ]),
    saddle,
    nose,
  );

  const tl = Math.sqrt(tl2);
  const tu = scale(td, 1 / tl);
  const tn = rot(tu, -90);
  const neckBase = add(pose.hip, add(scale(tu, P.neckBase[0] * tl), scale(tn, P.neckBase[1] * H)));
  const ang = 90 - P.headRestLeanDeg - HEAD_PITCH * (90 - pose.torsoAngle);
  const hu: Vec2 = { x: Math.cos(rad(ang)), y: Math.sin(rad(ang)) };
  const headLen = P.head.lengthOverH * H;
  const headTop = add(neckBase, scale(hu, headLen));
  const head = segmentOutline(P.head, neckBase, headTop, H, -1, false);

  // helmet: a smooth shell centred high on the head axis
  const hn = rot(hu, -90);
  const mid = subProfile(P.head, HELMET.t, HELMET.t, 0, 2);
  const c = add(neckBase, scale(hu, HELMET.t * headLen));
  const a = (1 - HELMET.t) * headLen + HELMET.extraA;
  const f = mid.front[0] * H + HELMET.pad;
  const b = -mid.back[0] * H + HELMET.pad;
  const helmet: Vec2[] = [];
  for (let th = -12; th <= 192; th += 12) {
    const cs = Math.cos(rad(th));
    const sn = Math.sin(rad(th));
    helmet.push(add(c, add(scale(hn, cs * (cs > 0 ? f : b)), scale(hu, Math.max(sn, -0.1) * a))));
  }
  helmet.push(add(c, add(scale(hn, -b * 0.85), scale(hu, -0.12 * a))));
  helmet.push(add(c, add(scale(hn, f * 1.12), scale(hu, -0.05 * a))));

  return {
    torso: floorToSaddle(rawTorso, saddle, nose),
    seat,
    head,
    jersey: segmentOutline(subProfile(P.torso, JERSEY[0], JERSEY[1], KIT_PAD), pose.hip, pose.shoulder, H, -1, false),
    helmet,
    neckBase,
    headTop,
  };
}

export function armArt(pose: RiderPose, body: ArtBody) {
  const P = PROFILES[body.sex];
  const H = body.height;
  const fe = sub(pose.hand, pose.elbow);
  const fl = len(fe);
  const wrist = add(pose.elbow, scale(unit(fe), Math.max(0, fl - WRIST_BACK * H)));
  return {
    upper: segmentOutline(P.upperArm, pose.shoulder, pose.elbow, H, 1, true),
    forearm: segmentOutline(P.forearm, pose.elbow, wrist, H, 1, true),
    fist: capsulePoints(wrist, pose.hand, FIST_R[0] * H, FIST_R[1] * H),
    sleeve: segmentOutline(subProfile(P.upperArm, SLEEVE[0], SLEEVE[1], KIT_PAD), pose.shoulder, pose.elbow, H, 1, false),
  };
}
