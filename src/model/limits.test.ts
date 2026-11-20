import { describe, expect, it } from 'vitest';
import { resolveSegments } from './body';
import { forwardLayout } from './geometry';
import {
  highestWhere, impossible, limitCost, MIN_HIP, MIN_KNEE_TOP, nearestPossible, possibleRange, POST_SHOWING, type Impossible,
} from './limits';
import { evaluateFit } from './pose';
import { DEFAULT_COMPONENTS, DEFAULT_PARAMS } from './presets';
import { makeContext } from './riding';
import { bandsFor, STYLES } from './styles';
import { TEST_BODY, TEST_FRAMES } from './testFrames';
import type { Evaluation, PoseEval } from './types';

describe('possibleRange', () => {
  const band = (a: number, b: number) => (v: number): Impossible | null => (v < a ? 'knee' : v > b ? 'pedal' : null);
  it('finds the edges to the step', () => {
    expect(possibleRange(550, 900, 0.5, 700, band(612.3, 781.7))).toEqual({ lo: 612.5, hi: 781.5, lowWhy: 'knee', highWhy: 'pedal' });
  });
  it('leaves an unblocked end alone', () => {
    expect(possibleRange(0, 40, 5, 10, band(-1, 22))).toEqual({ lo: 0, hi: 20, lowWhy: null, highWhy: 'pedal' });
  });
  it('keeps an impossible current value reachable', () => {
    const r = possibleRange(550, 900, 0.5, 850, band(600, 780));
    expect(r.lo).toBe(600);
    expect(r.hi).toBe(850);
  });
  it('does not block anything when nothing is possible', () => {
    expect(possibleRange(0, 20, 1, 5, () => 'bars')).toEqual({ lo: 0, hi: 20, lowWhy: null, highWhy: null });
  });
});

describe('nearestPossible', () => {
  const band = (a: number, b: number) => (v: number): Impossible | null => (v < a ? 'knee' : v > b ? 'pedal' : null);
  it('keeps a possible value', () => {
    expect(nearestPossible(550, 900, 0.5, 700, band(600, 780))).toBe(700);
  });
  it('finds the edge nearest an impossible value, on either side', () => {
    expect(nearestPossible(550, 900, 0.5, 850, band(600, 781.7))).toBe(781.5);
    expect(nearestPossible(550, 900, 0.5, 560, band(612.3, 781.7))).toBe(612.5);
  });
  it('is null when nothing is possible', () => {
    expect(nearestPossible(0, 20, 1, 5, () => 'bars')).toBeNull();
  });
});

describe('highestWhere', () => {
  it('finds the last value that holds', () => {
    expect(highestWhere(550, 900, 0.5, (v) => v <= 742.3)).toBe(742);
    expect(highestWhere(550, 900, 0.5, () => true)).toBe(900);
    expect(highestWhere(550, 900, 0.5, () => false)).toBeNull();
  });
});

describe('saddle height limits for the test rider', () => {
  const seg = resolveSegments(TEST_BODY);
  const frame = TEST_FRAMES[1];
  const style = STYLES.endurance;
  const ctx = makeContext(frame, DEFAULT_COMPONENTS, 'neutral', style.defaultEffort);
  const targets = bandsFor(style, 'medium');
  const why = (h: number) =>
    impossible(evaluateFit(seg, forwardLayout(frame, DEFAULT_COMPONENTS, { ...DEFAULT_PARAMS, saddleHeight: h }), ctx, targets), h - frame.seatTubeLength);
  it('stops the saddle where the foot leaves the pedal', () => {
    const r = possibleRange(550, 900, 0.5, DEFAULT_PARAMS.saddleHeight, why);
    expect(r.highWhy).toBe('pedal');
    expect(r.hi).toBeGreaterThan(760);
    expect(r.hi).toBeLessThan(800);
    expect(why(r.hi)).toBeNull();
    expect(why(r.hi + 0.5)).toBe('pedal');
    // The 540 mm seat tube keeps the saddle 30 mm above it.
    expect(r.lo).toBe(570);
    expect(r.lowWhy).toBe('postLow');
  });
  it('lets every rider point their toes to reach the pedal, whatever their usual ankling', () => {
    const top = (ankling: 'heelDrop' | 'neutral' | 'toePoint') => {
      const c = makeContext(frame, DEFAULT_COMPONENTS, ankling, style.defaultEffort);
      const w = (h: number) =>
        impossible(evaluateFit(seg, forwardLayout(frame, DEFAULT_COMPONENTS, { ...DEFAULT_PARAMS, saddleHeight: h }), c, targets), h - frame.seatTubeLength);
      return possibleRange(550, 900, 0.5, DEFAULT_PARAMS.saddleHeight, w).hi;
    };
    expect(top('heelDrop')).toBe(top('toePoint'));
    expect(top('neutral')).toBe(top('toePoint'));
  });
});

describe('impossible', () => {
  const pose = (m: Partial<PoseEval['metrics']>, extra: Partial<PoseEval> = {}): PoseEval => ({
    contact: 'hoods', overextended: false, kneeTopCrank: 0, hipCrank: 0, legShortfall: 0, overreach: false, pelvicTilt: 12, comX: 0,
    metrics: { knee: 145, kneeTop: 70, hip: 60, torso: 45, shoulder: 90, elbow: 155, seatAngle: 73, handLoad: 30, kops: 0, ...m },
    ...extra,
  });
  const ev = (p: PoseEval): Evaluation => ({ poses: [p], peakKneeCrank: 0, toeClearance: Infinity });
  it('passes an ordinary position', () => {
    expect(impossible(ev(pose({})), 200)).toBeNull();
    expect(limitCost(ev(pose({})), 200)).toBe(0);
  });
  it('stops the seatpost at both ends', () => {
    expect(impossible(ev(pose({})), POST_SHOWING[0] - 1)).toBe('postLow');
    expect(impossible(ev(pose({})), POST_SHOWING[1] + 1)).toBe('postHigh');
    expect(impossible(ev(pose({})), POST_SHOWING[0])).toBeNull();
    expect(limitCost(ev(pose({})), POST_SHOWING[1] + 20)).toBe(60);
  });
  it('stops a hip or knee folded past what a body can do', () => {
    expect(impossible(ev(pose({ hip: MIN_HIP - 1 })), 200)).toBe('hip');
    expect(impossible(ev(pose({ kneeTop: MIN_KNEE_TOP - 1 })), 200)).toBe('knee');
    expect(limitCost(ev(pose({ hip: MIN_HIP - 5 })), 200)).toBe(55);
  });
  it('names the pedal before the bars', () => {
    expect(impossible(ev(pose({}, { overextended: true, overreach: true })), 200)).toBe('pedal');
  });
});
