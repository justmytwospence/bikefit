import { describe, expect, it } from 'vitest';
import { forwardLayout, noseSetback, railForSetback } from './geometry';
import { DEFAULT_COMPONENTS, DEFAULT_PARAMS } from './presets';
import { SPIKE_FRAME } from './testFrames';

const P = { ...DEFAULT_PARAMS, saddleHeight: 735, seatpostSetback: 15, railOffset: 0, spacers: 20, stemLength: 100, stemAngle: -6 };

describe('forwardLayout', () => {
  it('matches hand-calculated points', () => {
    const L = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, P);
    expect(L.saddle.x).toBeCloseTo(-223.75, 1);
    expect(L.saddle.y).toBeCloseTo(704.73, 1);
    expect(L.hoods.x).toBeCloseTo(573.54, 1);
    expect(L.hoods.y).toBeCloseTo(661.9, 1);
    expect(L.drops.x).toBeCloseTo(508.54, 1);
    expect(L.drops.y).toBeCloseTo(521.9, 1);
    expect(L.nose.x).toBeCloseTo(-73.75, 1);
  });
  it('more spacers moves the hands back and up', () => {
    const a = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, P);
    const b = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, { ...P, spacers: 30 });
    expect(b.hoods.x).toBeLessThan(a.hoods.x);
    expect(b.hoods.y).toBeGreaterThan(a.hoods.y);
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

describe('nose setback', () => {
  it('reports the nose behind the BB', () => {
    expect(noseSetback(SPIKE_FRAME, DEFAULT_COMPONENTS, P)).toBeCloseTo(73.75, 1);
  });
  it('railForSetback round-trips', () => {
    const rail = railForSetback(SPIKE_FRAME, DEFAULT_COMPONENTS, P, 60);
    expect(noseSetback(SPIKE_FRAME, DEFAULT_COMPONENTS, { ...P, railOffset: rail })).toBeCloseTo(60, 0);
    expect(Math.abs(noseSetback(SPIKE_FRAME, DEFAULT_COMPONENTS, { ...P, railOffset: rail }) - 60)).toBeLessThanOrEqual(0.25);
  });
  it('bar rotation turns the hoods and drops about the clamp', () => {
    const a = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, P);
    const up = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, { ...P, barRoll: 5 });
    const down = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, { ...P, barRoll: -5 });
    const d = (L: typeof a) => Math.hypot(L.hoods.x - L.clamp.x, L.hoods.y - L.clamp.y);
    expect(Math.abs(d(up) - d(a))).toBeLessThan(1e-9);
    expect(up.hoods.y).toBeGreaterThan(a.hoods.y);
    expect(down.hoods.y).toBeLessThan(a.hoods.y);
  });
  it('saddle angle tilts the nose about the saddle point', () => {
    const a = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, P);
    const t = forwardLayout(SPIKE_FRAME, DEFAULT_COMPONENTS, { ...P, saddleTilt: -5 });
    expect(t.saddle).toEqual(a.saddle);
    expect(t.nose.y).toBeCloseTo(a.saddle.y - 150 * Math.sin((5 * Math.PI) / 180), 6);
  });
});
