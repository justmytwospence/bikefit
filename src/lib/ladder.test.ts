import { describe, expect, it } from 'vitest';
import { optimizeFit, type FitProblem, type FitResult } from '../model/optimize';
import { DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS } from '../model/presets';
import { poseWeights } from '../model/riding';
import { bandsFor, STYLES } from '../model/styles';
import { resolveSegments } from '../model/body';
import { TEST_BODY, TEST_FRAMES } from '../model/testFrames';
import { buildLadder, sameParams, STEPS, stepLocks, stepStart } from './ladder';
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

describe('stepLocks and stepStart', () => {
  it('adds pins to the step', () => {
    expect(stepLocks('tools', {})).toEqual(presetLocks('tools'));
    const l = stepLocks('all', { spacers: true });
    expect(Object.entries(l).filter(([, v]) => v).map(([k]) => k)).toEqual(['spacers']);
  });
  it('starts from the current setup except pins', () => {
    const t = { ...P, spacers: 5, stemLength: 80 };
    const s = stepStart(P, t, { spacers: true });
    expect(s.spacers).toBe(5);
    expect(s.stemLength).toBe(P.stemLength);
  });
});

describe('buildLadder', () => {
  it('replaces a costlier step with the one below', () => {
    const l = buildLadder([fake(1, 700), fake(2, 710), fake(0.5, 720)], () => 80, 70, 'k');
    expect(l.steps.map((s) => s.params.saddleHeight)).toEqual([700, 700, 720]);
    expect(l.steps.map((s) => s.same)).toEqual([false, true, false]);
  });
  it('suggests the lowest step within 3 points of the best', () => {
    const r = [fake(1, 1), fake(1, 2), fake(1, 3)];
    const sug = (a: number, b: number, c: number) => buildLadder(r, byHeight({ 1: a, 2: b, 3: c }), 50, 'k').suggested;
    expect(sug(80, 82, 84)).toBe(1);
    expect(sug(70, 81, 84)).toBe(1);
    expect(sug(70, 75, 84)).toBe(2);
  });
  it('suggests none when nothing beats the current setup', () => {
    expect(buildLadder([fake(1, 1), fake(1, 2), fake(1, 3)], () => 60, 70, 'k').suggested).toBe(-1);
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
    const l = buildLadder(results, () => 80, 70, 'k');
    for (const k of ['stemLength', 'stemAngle', 'seatpostSetback', 'crankLength'] as const) expect(l.steps[0].params[k]).toBe(P[k]);
    expect(l.steps[1].params.crankLength).toBe(P.crankLength);
  });
});
