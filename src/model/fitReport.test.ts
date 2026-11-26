import { describe, expect, it } from 'vitest';
import { forwardLayout } from './geometry';
import { matchPosition, reportFromSetup, reportPosition, validReport, offsetText, type FitReport } from './fitReport';
import { DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS } from './presets';
import { TEST_FRAMES } from './testFrames';
import type { Frame } from './types';

export const RETUL: FitReport = {
  label: 'Retül', saddleHeight: 698, seatAngle: 74, saddleSetback: -59, saddleAngle: 0,
  gripReach: 550, gripDrop: -14, crankLength: 172.5,
};
export const COMP = { ...DEFAULT_COMPONENTS, hoodReach: 22, hoodRise: 28 };
export const GRIZL_S: Frame = {
  id: 'grizl-s', name: 'Grizl S', stack: 556, reach: 397, seatTubeAngle: 73.5, headTubeAngle: 71,
  headTubeLength: 118, seatTubeLength: 492, chainstay: 435, wheelbase: 1036, bbDrop: 75, maxSpacers: 40, tyreWidth: 40,
};

describe('fit report positions', () => {
  it('converts Retül numbers to contact points', () => {
    const p = reportPosition(RETUL, COMP);
    expect(p.saddle.y).toBeCloseTo(671, 0);
    expect(p.nose.x).toBe(-59);
    expect(p.hoods.x).toBeCloseTo(550, 0);
    expect(p.hoods.y).toBeCloseTo(657, 0);
  });
  it('reportFromSetup and reportPosition agree with forwardLayout', () => {
    const frame = TEST_FRAMES[1];
    const p = { ...DEFAULT_PARAMS, saddleTilt: -4 };
    const L = forwardLayout(frame, DEFAULT_COMPONENTS, p);
    const pos = reportPosition(reportFromSetup(frame, DEFAULT_COMPONENTS, p), DEFAULT_COMPONENTS);
    expect(Math.hypot(pos.saddle.x - L.saddle.x, pos.saddle.y - L.saddle.y)).toBeLessThan(1.5);
    expect(Math.hypot(pos.hoods.x - L.hoods.x, pos.hoods.y - L.hoods.y)).toBeLessThan(1.5);
    expect(Math.hypot(pos.nose.x - L.nose.x, pos.nose.y - L.nose.y)).toBeLessThan(1.5);
  });
  it('matchPosition reproduces a setup from its own report', () => {
    const frame = TEST_FRAMES[1];
    const p = { ...DEFAULT_PARAMS, saddleHeight: 740, railOffset: 4, spacers: 15, stemLength: 90, stemAngle: -6 };
    const pos = reportPosition(reportFromSetup(frame, DEFAULT_COMPONENTS, p), DEFAULT_COMPONENTS);
    const m = matchPosition(frame, DEFAULT_COMPONENTS, pos, DEFAULT_OPTIONS, DEFAULT_PARAMS);
    expect(Math.abs(m.params.saddleHeight - p.saddleHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(m.params.railOffset - p.railOffset)).toBeLessThanOrEqual(1.5);
    expect(m.params.stemLength).toBe(90);
    expect(m.params.stemAngle).toBe(-6);
    expect(m.params.spacers).toBe(15);
  });
  it('matchPosition moves a fit to another bike', () => {
    const base = { ...DEFAULT_PARAMS, crankLength: 172.5 };
    const m = matchPosition(GRIZL_S, COMP, reportPosition(RETUL, COMP), DEFAULT_OPTIONS, base);
    expect(Math.hypot(m.hoodsOff.x, m.hoodsOff.y)).toBeLessThan(6);
    expect(Math.hypot(m.saddleOff.x, m.saddleOff.y)).toBeLessThan(1);
  });
  it('words offsets', () => {
    expect(offsetText({ x: 0.5, y: -1 })).toBe('where your fit has it');
    expect(offsetText({ x: -5, y: 12 })).toBe('12 mm higher and 5 mm further back');
  });
  it('validates saved reports', () => {
    expect(validReport(RETUL)).toEqual(RETUL);
    expect(validReport({ ...RETUL, saddleHeight: undefined })).toBeNull();
    expect(validReport({ ...RETUL, label: undefined })!.label).toBe('');
    expect(validReport(null)).toBeNull();
  });
});
