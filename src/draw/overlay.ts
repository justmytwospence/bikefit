import type { LinkId } from '../lib/linkIds';
import type { Units } from '../lib/units';
import { frameSkeleton, steerAxis } from '../model/geometry';
import type { RiderPose } from '../model/pose';
import type { Components, FitParams, Frame, Layout, PoseEval, Segments } from '../model/types';
import { add, rotate, scale, sub, unit, type Vec2 } from '../model/vec';
import { angleOf, arcPath, dimension, polar } from './shapes';

/** What the drawing shows for one linked number: dimension lines, guides, highlighted parts, arcs and a label. */
export interface Overlay {
  label: string;
  at: Vec2;
  dims: ReturnType<typeof dimension>[];
  /** Thin dashed lines. */
  guides: [Vec2, Vec2][];
  /** Thick lines over a part or limb. */
  strong: Vec2[][];
  /** Path data. */
  arcs: string[];
  rings: { c: Vec2; r: number }[];
}

export interface OverlayInput {
  id: LinkId;
  layout: Layout;
  frame: Frame;
  components: Components;
  params: FitParams;
  pose: RiderPose;
  poseEval: PoseEval;
  seg: Segments;
  toe: Vec2 | null;
  toeClearance: number;
  units: Units;
}

const v = (x: number, y: number): Vec2 => ({ x, y });
const mid = (pts: Vec2[]) => {
  const a = pts[0];
  const b = pts[pts.length - 1];
  return v((a.x + b.x) / 2, (a.y + b.y) / 2);
};

/** The overlay for a linked number, or null when the drawing already shows it (joint angles) or an inset does. */
export function overlayFor(i: OverlayInput): Overlay | null {
  const { layout: L, frame, components: c, params: p, pose, seg } = i;
  const sk = frameSkeleton(frame);
  const h = steerAxis(frame);
  const mm = (n: number) => `${Math.round(n)} mm`;
  const deg1 = (n: number) => `${n.toFixed(1)}°`;
  const len = (n: number) => (i.units === 'imperial' ? `${(n / 25.4).toFixed(1)} in` : `${Math.round(n)} mm`);
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const signed = (a: number) => (a === 0 ? '0°' : (a < 0 ? '−' : '+') + fmt(Math.abs(a)) + '°');
  const tyre = frame.tyreWidth;
  const bb = v(0, 0);

  const dimO = (label: string, d: ReturnType<typeof dimension>, guides: [Vec2, Vec2][] = []): Overlay => ({
    label, at: d.mid, dims: [d], guides, strong: [], arcs: [], rings: [],
  });
  const limb = (name: string, pts: Vec2[], value: number | null): Overlay => {
    const m = mid(pts);
    return {
      label: value === null ? name : `${name} ${len(value)}`, at: v(m.x - 110, m.y),
      dims: [], guides: [], strong: [pts], arcs: [], rings: [],
    };
  };
  const angleAt = (label: string, c0: Vec2, toward: Vec2, r: number, strong: Vec2[][], guides: [Vec2, Vec2][]): Overlay => {
    const arc = arcPath(c0, 180, angleOf(c0, toward), r);
    return { label, at: polar(c0, arc.mid, r + 60), dims: [], guides, strong, arcs: [arc.path], rings: [] };
  };

  switch (i.id) {
    case 'm:knee': case 'm:kneeTop': case 'm:hip': case 'm:torso': case 'm:shoulder': case 'm:elbow':
    case 'cleat': case 'c:footStack':
      return null;
    case 'tilt':
      return {
        label: `Saddle angle ${signed(p.saddleTilt)}`, at: v(L.saddle.x, L.saddle.y + 90), dims: [],
        guides: [[v(L.saddle.x - 140, L.saddle.y), v(L.nose.x + 40, L.saddle.y)]],
        strong: [[add(L.saddle, rotate(v(-120, 0), p.saddleTilt)), L.nose]], arcs: [], rings: [],
      };
    case 'barRoll':
      return {
        label: `Bar rotation ${signed(p.barRoll)}`, at: v(L.clamp.x, L.clamp.y + 110), dims: [],
        guides: [[L.clamp, v(L.clamp.x + 160, L.clamp.y)]], strong: [[L.clamp, L.hoods], [L.clamp, L.drops]],
        arcs: [], rings: [],
      };
    case 'saddleHeight':
      return dimO(`Saddle height ${fmt(p.saddleHeight)} mm`, dimension(bb, L.seatAxisTop, 90));
    case 'spacers': {
      if (p.spacers <= 0) return null;
      return dimO(`Spacers ${fmt(p.spacers)} mm`, dimension(L.headTop, add(L.headTop, scale(h, p.spacers)), -60));
    }
    case 'stem':
      return dimO(`Stem ${fmt(p.stemLength)} mm ${signed(p.stemAngle)}`, dimension(L.stemBase, L.clamp, 50));
    case 'crank':
      return dimO(`Cranks ${fmt(p.crankLength)} mm`, dimension(bb, pose.spindle, 40));
    case 'setback':
      return dimO(`Setback ${Math.round(-L.nose.x)} mm`, dimension(v(L.nose.x, 160), v(0, 160), 0), [
        [L.nose, v(L.nose.x, 160)], [bb, v(0, 180)],
      ]);
    case 'f:stack':
      return dimO(`Stack ${mm(frame.stack)}`, dimension(v(frame.reach, 0), v(frame.reach, frame.stack), -140), [
        [bb, v(frame.reach, 0)],
      ]);
    case 'f:reach':
      return dimO(`Reach ${mm(frame.reach)}`, dimension(v(0, frame.stack), v(frame.reach, frame.stack), 60), [
        [bb, v(0, frame.stack)],
      ]);
    case 'f:seatTubeAngle':
      return angleAt(`Seat tube angle ${deg1(frame.seatTubeAngle)}`, bb, sk.seatCluster, 200,
        [[bb, sk.seatCluster]], [[bb, v(-260, 0)]]);
    case 'f:headTubeAngle':
      return angleAt(`Head tube angle ${deg1(frame.headTubeAngle)}`, sk.headBottom, sk.headTop, 200,
        [[sk.headBottom, sk.headTop]], [[sk.headBottom, v(sk.headBottom.x - 260, sk.headBottom.y)]]);
    case 'f:headTubeLength':
      return dimO(`Head tube ${mm(frame.headTubeLength)}`, dimension(sk.headBottom, sk.headTop, -60));
    case 'f:seatTubeLength':
      return dimO(`Seat tube ${mm(frame.seatTubeLength)}`, dimension(bb, sk.seatCluster, 70));
    case 'f:chainstay':
      return dimO(`Chainstay ${mm(frame.chainstay)}`, dimension(sk.rearAxle, bb, -60));
    case 'f:wheelbase':
      return dimO(`Wheelbase ${mm(frame.wheelbase)}`, dimension(sk.rearAxle, sk.frontAxle, -70));
    case 'f:bbDrop':
      return dimO(`BB drop ${mm(frame.bbDrop)}`, dimension(v(150, frame.bbDrop), v(150, 0), 0), [
        [sk.rearAxle, sk.frontAxle],
      ]);
    case 'f:maxSpacers':
      return dimO(`Room for spacers ${mm(frame.maxSpacers)}`,
        dimension(L.headTop, add(L.headTop, scale(h, frame.maxSpacers)), -60));
    case 'f:tyreWidth': {
      const fx = sk.frontAxle.x;
      return dimO(`Tyres ${mm(tyre)}`, dimension(v(fx, frame.bbDrop + 311), v(fx, frame.bbDrop + 311 + tyre), 70));
    }
    case 'c:barReach':
      return dimO(`Bar reach ${mm(c.barReach)}`, dimension(L.clamp, v(L.clamp.x + c.barReach, L.clamp.y), 50));
    case 'c:barDrop': {
      const X = L.clamp.x + c.barReach;
      return dimO(`Bar drop ${mm(c.barDrop)}`, dimension(v(X, L.clamp.y), v(X, L.clamp.y - c.barDrop), -50));
    }
    case 'c:hoodReach': {
      const X = L.clamp.x + c.barReach;
      return dimO(`Hood reach ${mm(c.hoodReach)}`, dimension(v(X, L.hoods.y), v(L.hoods.x, L.hoods.y), 50));
    }
    case 'c:hoodRise':
      return dimO(`Hood rise ${mm(c.hoodRise)}`, dimension(v(L.hoods.x, L.clamp.y), L.hoods, -50));
    case 'c:saddleLength':
      return dimO(`Saddle ${mm(c.saddleLength)}`, dimension(v(L.nose.x - c.saddleLength, L.saddle.y), L.nose, 60));
    case 'c:headsetCap':
      return dimO(`Headset cap ${mm(c.headsetCap)}`, dimension(
        add(L.headTop, scale(h, p.spacers)), add(L.headTop, scale(h, p.spacers + c.headsetCap)), -60,
      ));
    case 'r:reach': {
      const y = Math.max(L.saddle.y, L.clamp.y) + 90;
      return dimO(`Saddle to bar reach ${mm(L.clamp.x - L.nose.x)}`, dimension(v(L.nose.x, y), v(L.clamp.x, y), 0), [
        [L.nose, v(L.nose.x, y)], [L.clamp, v(L.clamp.x, y)],
      ]);
    }
    case 'r:drop': {
      const x = L.clamp.x + 120;
      return dimO(`Saddle to bar drop ${mm(L.saddle.y - L.clamp.y)}`, dimension(v(x, L.saddle.y), v(x, L.clamp.y), 0), [
        [L.saddle, v(x, L.saddle.y)], [L.clamp, v(x, L.clamp.y)],
      ]);
    }
    case 'r:hoods':
      return {
        label: `Hoods ${mm(L.hoods.x)} forward, ${mm(L.hoods.y)} up`, at: add(L.hoods, v(0, 90)), dims: [],
        guides: [[bb, v(L.hoods.x, 0)], [v(L.hoods.x, 0), L.hoods]], strong: [], arcs: [], rings: [{ c: L.hoods, r: 30 }],
      };
    case 'r:seatpost': {
      const showing = p.saddleHeight - frame.seatTubeLength;
      if (showing <= 0) return null;
      return dimO(`Seatpost showing ${mm(showing)}`, dimension(sk.seatCluster, L.seatAxisTop, 90));
    }
    case 'r:toe': {
      if (!i.toe || !Number.isFinite(i.toeClearance)) return null;
      const t = Math.round(i.toeClearance);
      const q = add(sk.frontAxle, scale(unit(sub(i.toe, sk.frontAxle)), 311 + tyre));
      return {
        label: t < 0 ? `Toe overlap ${-t} mm` : `Toe clearance ${t} mm`, at: add(i.toe, v(0, -90)), dims: [], guides: [],
        strong: [[i.toe, q]], arcs: [], rings: [{ c: i.toe, r: 26 }],
      };
    }
    case 'm:seatAngle': {
      const arc = arcPath(bb, 180, angleOf(bb, L.saddle), 220);
      return {
        label: `Seat angle ${deg1(i.poseEval.metrics.seatAngle)}`, at: polar(bb, arc.mid, 290), dims: [],
        guides: [[bb, L.saddle], [bb, v(-260, 0)]], strong: [], arcs: [arc.path], rings: [],
      };
    }
    case 'm:handLoad': {
      const groundY = frame.bbDrop - (311 + tyre);
      const x = i.poseEval.comX;
      return {
        label: `Hand load ${Math.round(i.poseEval.metrics.handLoad)}%`, at: add(pose.hand, v(40, 130)), dims: [],
        guides: [[v(x, groundY), v(x, pose.hip.y)]], strong: [], arcs: [],
        rings: [{ c: pose.hand, r: 44 }, { c: v(x, pose.hip.y - 150), r: 24 }],
      };
    }
    case 'm:kops': {
      const kx = pose.knee.x + seg.kneeFront;
      const d = Math.round(kx - pose.spindle.x);
      const y = pose.spindle.y - 70;
      const label = Math.abs(d) < 1
        ? 'Knee level with the pedal axle'
        : `Knee ${Math.abs(d)} mm ${d > 0 ? 'ahead of' : 'behind'} the pedal axle`;
      return {
        label, at: v((pose.spindle.x + kx) / 2, y - 60), dims: [dimension(v(pose.spindle.x, y), v(kx, y), 0)],
        guides: [[v(kx, pose.knee.y), v(kx, pose.spindle.y)], [pose.spindle, v(pose.spindle.x, pose.spindle.y - 90)]],
        strong: [], arcs: [], rings: [],
      };
    }
    case 'b:femur': return limb('Thigh', [pose.hip, pose.knee], seg.femur);
    case 'b:tibia': return limb('Shin', [pose.knee, pose.ankle], seg.tibia);
    case 'b:torso': return limb('Torso', [pose.hip, pose.shoulder], seg.torso);
    case 'b:upperArm': return limb('Upper arm', [pose.shoulder, pose.elbow], seg.upperArm);
    case 'b:forearmGrip': return limb('Forearm to grip', [pose.elbow, pose.hand], seg.forearmGrip);
    case 'b:arm': return limb('Arm', [pose.shoulder, pose.elbow, pose.hand], seg.upperArm + seg.forearmGrip);
    case 'b:inseam': return limb('Legs (from your inseam)', [pose.hip, pose.knee, pose.ankle], null);
    case 'b:footLength': case 'b:shoe': return limb('Foot', [pose.ankle, pose.toe], seg.footLength);
    case 'b:height':
      return {
        label: 'Sets every body length you have not measured', at: add(pose.shoulder, v(-200, 120)), dims: [], guides: [],
        strong: [[pose.ankle, pose.knee, pose.hip, pose.shoulder], [pose.shoulder, pose.elbow, pose.hand]], arcs: [], rings: [],
      };
  }
  return null;
}
