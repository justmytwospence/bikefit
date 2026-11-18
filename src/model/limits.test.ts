import { describe, expect, it } from 'vitest';
import { resolveSegments } from './body';
import { forwardLayout } from './geometry';
import { impossible, possibleRange, type Impossible } from './limits';
import { evaluateFit } from './pose';
import { DEFAULT_COMPONENTS, DEFAULT_PARAMS } from './presets';
import { makeContext } from './riding';
import { bandsFor, STYLES } from './styles';
import { TEST_BODY, TEST_FRAMES } from './testFrames';

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

describe('saddle height limits for the test rider', () => {
  const seg = resolveSegments(TEST_BODY);
  const frame = TEST_FRAMES[1];
  const style = STYLES.endurance;
  const ctx = makeContext(frame, DEFAULT_COMPONENTS, 'neutral', style.defaultEffort);
  const targets = bandsFor(style, 'medium');
  const why = (h: number) =>
    impossible(evaluateFit(seg, forwardLayout(frame, DEFAULT_COMPONENTS, { ...DEFAULT_PARAMS, saddleHeight: h }), ctx, targets));
  it('stops the saddle where the foot leaves the pedal', () => {
    const r = possibleRange(550, 900, 0.5, DEFAULT_PARAMS.saddleHeight, why);
    expect(r.highWhy).toBe('pedal');
    expect(r.hi).toBeGreaterThan(760);
    expect(r.hi).toBeLessThan(800);
    expect(why(r.hi)).toBeNull();
    expect(why(r.hi + 0.5)).toBe('pedal');
    expect(r.lo).toBe(550);
  });
});
