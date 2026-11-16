import { describe, expect, it } from 'vitest';
import { resolveSegments } from './body';
import { forwardLayout } from './geometry';
import { SPIKE_FRAME } from './testFrames';
import { evaluateFit, riderPose, solveLeg } from './pose';
import { DEFAULT_BODY, DEFAULT_COMPONENTS, DEFAULT_PARAMS } from './presets';
import { len, sub } from './vec';

const seg = resolveSegments(DEFAULT_BODY);
const P = { ...DEFAULT_PARAMS, saddleHeight: 735, stemAngle: -6 };
const layout = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, P);

describe('evaluateFit', () => {
  it('matches the spike golden values', () => {
    const ev = evaluateFit(seg, layout, 20, 160);
    expect(ev.metrics.knee).toBeCloseTo(149.4, 0);
    expect(ev.metrics.hip).toBeCloseTo(64.1, 0);
    expect(ev.metrics.torso).toBeCloseTo(44.9, 0);
    expect(ev.metrics.shoulder).toBeCloseTo(86.4, 0);
    expect(ev.metrics.elbow).toBeCloseTo(160, 0);
    expect(ev.metrics.kops).toBeCloseTo(9.9, 0);
    expect(ev.overextended).toBe(false);
    expect(ev.overreach).toBe(false);
  });
  it('keeps limb lengths constant', () => {
    const hip = { x: layout.saddle.x, y: layout.saddle.y + seg.hipUp };
    for (const phi of [0, 90, 180, 270]) {
      const leg = solveLeg(seg, hip, 172.5, 20, phi);
      expect(len(sub(leg.knee, hip))).toBeCloseTo(seg.femur, 6);
      expect(len(sub(leg.ankle, leg.knee))).toBeCloseTo(seg.tibia, 6);
    }
  });
  it('flags overreach with a hand far away', () => {
    const ev = evaluateFit(seg, { ...layout, hand: { x: 1500, y: 700 } }, 20, 160);
    expect(ev.overreach).toBe(true);
    const p = riderPose(seg, { ...layout, hand: { x: 1500, y: 700 } }, 20, 160, 0);
    expect(p.elbowAngle).toBeCloseTo(180, 3);
  });
  it('flags an overextended leg with a high saddle on a short rider', () => {
    const s = resolveSegments({ ...DEFAULT_BODY, height: 1650, inseam: 770 });
    const L = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, { ...P, saddleHeight: 900 });
    expect(evaluateFit(s, L, 20, 160).overextended).toBe(true);
  });
});
