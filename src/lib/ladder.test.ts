import { describe, expect, it } from 'vitest';
import { optimizeFit, type FitProblem, type FitResult } from '../model/optimize';
import { DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS } from '../model/presets';
import { poseWeights } from '../model/riding';
import { bandsFor, STYLES } from '../model/styles';
import { resolveSegments } from '../model/body';
import { TEST_BODY, TEST_FRAMES } from '../model/testFrames';
import { buildLadder, sameParams, settle, STEPS, stepLocks } from './ladder';
import { presetLocks } from './knobs';

const P = DEFAULT_PARAMS;
const fake = (cost: number, saddleHeight: number): FitResult =>
  ({ params: { ...P, saddleHeight }, cost, notes: [], verdict: 'fits', flags: [] }) as unknown as FitResult;
const byHeight = (scores: Record<number, number>) => (p: { saddleHeight: number }) => scores[p.saddleHeight];

describe('sameParams', () => {
  it('ignores differences under a quarter', () => {
    expect(sameParams(P, { ...P, saddleHeight: P.saddleHeight + 0.2 })).toBe(true);
    expect(sameParams(P, { ...P, saddleHeight: P.saddleHeight + 0.5 })).toBe(false);
  });
});

describe('stepLocks', () => {
  it('adds pins to the step', () => {
    expect(stepLocks('tools', {})).toEqual(presetLocks('tools'));
    const l = stepLocks('all', { spacers: true });
    expect(Object.entries(l).filter(([, v]) => v).map(([k]) => k)).toEqual(['spacers']);
  });
});

describe('settle', () => {
  it('drops tiny changes and rounds the rest', () => {
    const p = { ...P, saddleHeight: P.saddleHeight + 1.5, railOffset: P.railOffset + 18.6 };
    const s = settle(p, P, () => 80);
    expect(s.saddleHeight).toBe(P.saddleHeight);
    expect(s.railOffset).toBe(P.railOffset + 19);
  });
  it('keeps a tiny change that is worth a point', () => {
    const p = { ...P, saddleHeight: P.saddleHeight + 1.5 };
    const s = settle(p, P, (q) => (q.saddleHeight === P.saddleHeight ? 79 : 80));
    expect(s.saddleHeight).toBe(P.saddleHeight + 1.5);
  });
});

describe('buildLadder', () => {
  const H = P.saddleHeight;
  const rs = (n: number) => [fake(1, H + 10), fake(1, H + 20), fake(1, H + 30)].slice(0, n);
  const ladder = (cur: number, a: number, b: number, c: number) =>
    buildLadder(rs(3), P, byHeight({ [H]: cur, [H + 10]: a, [H + 20]: b, [H + 30]: c }), 'k');
  it('a step that gains less than a point is the same as the one below', () => {
    const l = ladder(70, 80, 80, 85);
    expect(l.steps.map((s) => s.same)).toEqual([false, true, false]);
    expect(l.steps[1].params).toEqual(l.steps[0].params);
  });
  it('a first step that gains nothing is the same as the current setup', () => {
    const l = ladder(80, 80, 90, 90);
    expect(l.steps.map((s) => s.same)).toEqual([true, false, true]);
    expect(l.steps[0].params).toEqual(P);
  });
  it('suggests the lowest step within 3 points of the best', () => {
    expect(ladder(50, 81, 82, 84).suggested).toBe(0);
    expect(ladder(50, 70, 82, 84).suggested).toBe(1);
    expect(ladder(50, 70, 75, 84).suggested).toBe(2);
  });
  it('suggests none when the current setup is within 3 of the best', () => {
    expect(ladder(82, 84, 84, 85).suggested).toBe(-1);
  });
  it('keeps parts locked on lower steps', () => {
    const st = STYLES.endurance;
    const frame = TEST_FRAMES.find((f) => f.id === 'endurance-56')!;
    const p: FitProblem = {
      segments: resolveSegments(TEST_BODY), inseam: TEST_BODY.inseam, targets: bandsFor(st, 'medium'),
      poseWeights: poseWeights(st.defaultHands), ankling: 'neutral', effort: st.defaultEffort, frame,
      components: DEFAULT_COMPONENTS, options: DEFAULT_OPTIONS, baseline: P, current: P, locks: {}, mode: 'tune',
    };
    const results = STEPS.map((s) => optimizeFit({ ...p, locks: stepLocks(s, {}) }));
    buildLadder(results, P, () => 80, 'k');
    for (const k of ['stemLength', 'stemAngle', 'seatpostSetback', 'crankLength'] as const) expect(results[0].params[k]).toBe(P[k]);
    expect(results[1].params.crankLength).toBe(P.crankLength);
  });
});
