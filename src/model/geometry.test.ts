import { describe, expect, it } from 'vitest';
import { forwardLayout } from './geometry';
import { DEFAULT_COMPONENTS, DEFAULT_PARAMS } from './presets';
import { SPIKE_FRAME } from './testFrames';

const P = { ...DEFAULT_PARAMS, saddleHeight: 735, seatpostSetback: 15, railOffset: 0, spacers: 20, stemLength: 100, stemAngle: -6 };

describe('forwardLayout', () => {
  it('matches hand-calculated points', () => {
    const L = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, P);
    expect(L.saddle.x).toBeCloseTo(-223.75, 1);
    expect(L.saddle.y).toBeCloseTo(704.73, 1);
    expect(L.hand.x).toBeCloseTo(573.54, 1);
    expect(L.hand.y).toBeCloseTo(661.9, 1);
  });
  it('more spacers moves the hands back and up', () => {
    const a = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, P);
    const b = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, { ...P, spacers: 30 });
    expect(b.hand.x).toBeLessThan(a.hand.x);
    expect(b.hand.y).toBeGreaterThan(a.hand.y);
  });
  it('a level stem has equal base and clamp height', () => {
    const L = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, { ...P, stemAngle: -(90 - 73) });
    expect(L.clamp.y).toBeCloseTo(L.stemBase.y, 9);
  });
  it('vertical seat tube puts saddle above the BB', () => {
    const L = forwardLayout({ ...SPIKE_FRAME, seatTubeAngle: 90 }, DEFAULT_COMPONENTS, { ...P, seatpostSetback: 0, railOffset: 0 });
    expect(L.saddle.x).toBeCloseTo(0, 9);
    expect(L.saddle.y).toBeCloseTo(735, 9);
  });
});
