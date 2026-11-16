import { describe, expect, it } from 'vitest';
import { resolveSegments } from './body';
import { forwardLayout } from './geometry';
import { evaluateFit, riderPose, solveLeg } from './pose';
import { DEFAULT_BODY, DEFAULT_COMPONENTS, DEFAULT_PARAMS, EXAMPLE_FRAMES } from './presets';
import { makeContext } from './riding';
import { SPIKE_BODY, SPIKE_FRAME } from './testFrames';
import type { Ankling, Frame, PoseTarget } from './types';
import { len, sub } from './vec';

const seg = resolveSegments(SPIKE_BODY);
const P = { ...DEFAULT_PARAMS };
const layout = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, P);
const ctx = (a: Ankling = 'neutral', wkg = 2.5) => ({
  footStack: 20, ankling: a, wkg, frontAxle: null, wheelRadius: 0,
});
const targets = (hoodsEp = 160): PoseTarget[] => [
  { handContact: 'hoods', elbowPref: hoodsEp, bands: {} },
  { handContact: 'drops', elbowPref: 140, bands: {} },
];

describe('evaluateFit', () => {
  it('matches the spike golden values (hoods)', () => {
    const h = evaluateFit(seg, layout, ctx(), targets()).poses[0];
    expect(h.metrics.knee).toBeCloseTo(152.34, 1);
    expect(h.metrics.kneeTop).toBeCloseTo(68.44, 1);
    expect(h.metrics.hip).toBeCloseTo(63.99, 1);
    expect(h.metrics.torso).toBeCloseTo(45.46, 1);
    expect(h.metrics.shoulder).toBeCloseTo(85.43, 1);
    expect(h.metrics.elbow).toBeCloseTo(160, 1);
    expect(h.metrics.seatAngle).toBeCloseTo(72.39, 1);
    expect(h.metrics.handLoad).toBeCloseTo(23.73, 1);
    expect(h.metrics.kops).toBeCloseTo(8.33, 1);
    expect(h.overextended).toBe(false);
    expect(h.overreach).toBe(false);
  });
  it('matches the spike golden values (drops)', () => {
    const d = evaluateFit(seg, layout, ctx(), targets()).poses[1];
    expect(d.metrics.knee).toBeCloseTo(151.02, 1);
    expect(d.metrics.hip).toBeCloseTo(52.94, 1);
    expect(d.metrics.torso).toBeCloseTo(33.87, 1);
    expect(d.metrics.shoulder).toBeCloseTo(83.7, 1);
    expect(d.metrics.handLoad).toBeCloseTo(29.83, 1);
  });
  it('ankling and cleat position change the knee angle', () => {
    const knee = (a: Ankling, l = layout) => evaluateFit(seg, l, ctx(a), targets()).poses[0].metrics.knee;
    expect(knee('heelDrop')).toBeCloseTo(157.31, 1);
    expect(knee('toePoint')).toBeCloseTo(148.23, 1);
    expect(knee('neutral', forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, { ...P, cleatOffset: 15 }))).toBeCloseTo(154.5, 1);
  });
  it('more effort means less weight on the hands', () => {
    const hl = (w: number) => evaluateFit(seg, layout, ctx('neutral', w), targets()).poses[0].metrics.handLoad;
    expect(hl(0)).toBeCloseTo(30.29, 1);
    expect(hl(3.5)).toBeCloseTo(21.1, 1);
  });
  it('keeps limb lengths constant', () => {
    const c = ctx();
    const { hip } = riderPose(seg, layout, c, 'hoods', 160, 0);
    for (const phi of [0, 90, 180, 270]) {
      const leg = solveLeg(seg, hip, layout, c, phi);
      expect(len(sub(leg.knee, hip))).toBeCloseTo(seg.femur, 6);
      expect(len(sub(leg.ankle, leg.knee))).toBeCloseTo(seg.tibia, 6);
    }
  });
  it('flags overreach with a hand far away', () => {
    const L = { ...layout, hoods: { x: 1500, y: 700 } };
    expect(evaluateFit(seg, L, ctx(), targets()).poses[0].overreach).toBe(true);
    expect(riderPose(seg, L, ctx(), 'hoods', 160, 0).elbowAngle).toBeCloseTo(180, 3);
  });
  it('flags an overextended leg with a high saddle on a short rider', () => {
    const s = resolveSegments({ ...SPIKE_BODY, height: 1650, inseam: 770 });
    const L = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, { ...P, saddleHeight: 900 });
    expect(evaluateFit(s, L, ctx(), targets()).poses[0].overextended).toBe(true);
  });
});

describe('toe clearance', () => {
  const tg = targets();
  it('overlaps on a small frame with a short rider', () => {
    const f: Frame = { ...SPIKE_FRAME, stack: 545, reach: 385, headTubeAngle: 73, chainstay: 408, wheelbase: 985 };
    const s = resolveSegments({ ...DEFAULT_BODY, height: 1600, inseam: 740, overrides: { footLength: 0.152 * 1600 } });
    const c = makeContext(f, DEFAULT_COMPONENTS, 'neutral', 'tempo');
    const L = forwardLayout(f, DEFAULT_COMPONENTS, { ...P, saddleHeight: 650, crankLength: 170 });
    expect(evaluateFit(s, L, c, tg).toeClearance).toBeCloseTo(-11.6, 1);
  });
  it('default body on endurance-56', () => {
    const f = EXAMPLE_FRAMES.find((x) => x.id === 'endurance-56')!;
    const c = makeContext(f, DEFAULT_COMPONENTS, 'neutral', 'tempo');
    const L = forwardLayout(f, DEFAULT_COMPONENTS, P);
    expect(evaluateFit(seg, L, c, tg).toeClearance).toBeCloseTo(-3.07, 1);
  });
  it('is Infinity without a front wheel', () => {
    expect(evaluateFit(seg, layout, ctx(), targets()).toeClearance).toBe(Infinity);
  });
});
