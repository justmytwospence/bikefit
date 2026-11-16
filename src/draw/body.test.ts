import { describe, expect, it } from 'vitest';
import { resolveSegments } from '../model/body';
import { forwardLayout } from '../model/geometry';
import { riderPose } from '../model/pose';
import { DEFAULT_COMPONENTS, DEFAULT_PARAMS, EXAMPLE_FRAMES } from '../model/presets';
import { makeContext } from '../model/riding';
import { TEST_BODY } from '../model/testFrames';
import type { Sex } from '../model/types';
import type { Vec2 } from '../model/vec';
import { armArt, legArt, PROFILES, torsoArt } from './body';

function inPoly(p: Vec2, pts: Vec2[]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

const frame = EXAMPLE_FRAMES[1];

function setup(sex: Sex, H: number, crank: number, contact: 'hoods' | 'drops') {
  const inseam = 0.4719 * H;
  const seg = resolveSegments({ ...TEST_BODY, sex, height: H, inseam });
  const params = { ...DEFAULT_PARAMS, saddleHeight: 0.86 * inseam, crankLength: 170 };
  const ctx = makeContext(frame, DEFAULT_COMPONENTS, 'neutral', 'easy');
  const layout = forwardLayout(frame, DEFAULT_COMPONENTS, params);
  const pose = riderPose(seg, layout, ctx, contact, contact === 'drops' ? 140 : 158, crank);
  const body = { sex, height: H };
  return {
    pose, layout, body,
    leg: legArt(pose, body, layout.saddle, layout.nose),
    tor: torsoArt(pose, body, layout.saddle, layout.nose),
    arm: armArt(pose, body),
  };
}

describe('profiles', () => {
  it('has both sexes with 25 stations and a CC0 source', () => {
    expect(PROFILES.source.license).toBe('CC0-1.0');
    for (const sex of ['male', 'female'] as const) {
      for (const seg of ['thigh', 'calf', 'upperArm', 'forearm', 'torso', 'head'] as const) {
        const p = PROFILES[sex][seg];
        expect(p.front).toHaveLength(25);
        expect(p.back).toHaveLength(25);
        p.front.forEach((f, i) => expect(f).toBeGreaterThan(p.back[i]));
      }
    }
  });
  it('matches measured body depths', () => {
    const maxDepth = (sex: Sex, seg: 'thigh' | 'calf') =>
      Math.max(...PROFILES[sex][seg].front.map((f, i) => f - PROFILES[sex][seg].back[i]));
    expect(maxDepth('male', 'thigh')).toBeCloseTo(0.113, 1);
    expect(Math.abs(maxDepth('male', 'thigh') / 0.113 - 1)).toBeLessThan(0.15);
    expect(Math.abs(maxDepth('female', 'thigh') / 0.121 - 1)).toBeLessThan(0.15);
    expect(Math.abs(maxDepth('male', 'calf') / 0.071 - 1)).toBeLessThan(0.15);
    expect(Math.abs(maxDepth('female', 'calf') / 0.073 - 1)).toBeLessThan(0.15);
  });
});

describe('art stays on the joints', () => {
  for (const sex of ['male', 'female'] as const) {
    for (const H of [1550, 1780, 1900]) {
      for (const crank of [0, 90, 180, 270]) {
        for (const contact of ['hoods', 'drops'] as const) {
          it(`${sex} ${H} crank ${crank} ${contact}`, () => {
            const { pose: p, layout, leg, tor, arm } = setup(sex, H, crank, contact);
            expect(inPoly(p.hip, leg.thigh)).toBe(true);
            expect(inPoly(p.knee, leg.thigh)).toBe(true);
            expect(inPoly(p.knee, leg.calf)).toBe(true);
            expect(inPoly(p.ankle, leg.calf)).toBe(true);
            expect(inPoly(p.shoulder, tor.torso)).toBe(true);
            expect(inPoly(p.hip, tor.torso) || inPoly(p.hip, tor.seat)).toBe(true);
            expect(inPoly(p.shoulder, arm.upper)).toBe(true);
            expect(inPoly(p.elbow, arm.upper)).toBe(true);
            expect(inPoly(p.elbow, arm.forearm)).toBe(true);
            expect(inPoly(p.hand, arm.fist)).toBe(true);
            // rider rests on the saddle, not through it
            const kd = { x: p.knee.x - p.hip.x, y: p.knee.y - p.hip.y };
            const topOfThigh = leg.thigh.filter(
              (q) => ((q.x - p.hip.x) * kd.x + (q.y - p.hip.y) * kd.y) / (kd.x * kd.x + kd.y * kd.y) <= 0.3,
            );
            const span = [...tor.torso, ...tor.seat, ...topOfThigh].filter(
              (q) => q.x >= layout.saddle.x - 140 && q.x <= layout.nose.x,
            );
            expect(Math.min(...span.map((q) => q.y))).toBeGreaterThanOrEqual(layout.saddle.y + 3);
            // head and helmet fit in the view
            const top = Math.max(...tor.helmet.map((q) => q.y));
            expect(top).toBeLessThan(0.9 * H);
            expect(top).toBeGreaterThan(tor.neckBase.y);
          });
        }
      }
    }
  }
});

describe('sex and speed', () => {
  it('draws different torsos for the two sexes', () => {
    const m = setup('male', 1700, 270, 'hoods').tor.torso;
    const f = setup('female', 1700, 270, 'hoods').tor.torso;
    expect(m.some((q, i) => Math.hypot(q.x - f[i].x, q.y - f[i].y) > 2)).toBe(true);
  });
  it('evaluates in under 1 ms', () => {
    const s = setup('male', 1780, 270, 'hoods');
    const t = performance.now();
    for (let i = 0; i < 200; i++) {
      legArt(s.pose, s.body, s.layout.saddle, s.layout.nose);
      torsoArt(s.pose, s.body, s.layout.saddle, s.layout.nose);
      armArt(s.pose, s.body);
    }
    expect((performance.now() - t) / 200).toBeLessThan(1);
  });
});
