import { describe, expect, it } from 'vitest';
import { noseSetback } from '../model/geometry';
import { DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS } from '../model/presets';
import { TEST_FRAMES } from '../model/testFrames';
import { rad } from '../model/vec';
import { barsDrag, crankAngle, saddleDrag } from './drag';

const frame = TEST_FRAMES.find((f) => f.id === 'endurance-56')!;
const start = { ...DEFAULT_PARAMS, stemLength: 100, spacers: 20 };
const setback = (p: typeof start) => noseSetback(frame, DEFAULT_COMPONENTS, p);

describe('saddleDrag', () => {
  it('straight along the seat tube keeps the nose setback', () => {
    const d = { x: 0, y: 10 * Math.sin(rad(frame.seatTubeAngle)) };
    const p = saddleDrag(start, d, frame, DEFAULT_COMPONENTS, DEFAULT_OPTIONS);
    expect(p.saddleHeight).toBe(start.saddleHeight + 10);
    expect(Math.abs(setback({ ...start, ...p }) - setback(start))).toBeLessThanOrEqual(0.5);
  });
  it('forward reduces the setback by the drag', () => {
    const p = saddleDrag(start, { x: 10, y: 0 }, frame, DEFAULT_COMPONENTS, DEFAULT_OPTIONS);
    expect(p.saddleHeight).toBe(start.saddleHeight);
    expect(Math.abs(setback({ ...start, ...p }) - (setback(start) - 10))).toBeLessThanOrEqual(0.5);
  });
  it('stays inside the saddle height range', () => {
    const p = saddleDrag(start, { x: 0, y: 5000 }, frame, DEFAULT_COMPONENTS, DEFAULT_OPTIONS);
    expect(p.saddleHeight).toBe(DEFAULT_OPTIONS.saddleHeightRange[1]);
  });
});

describe('barsDrag', () => {
  it('clamps spacers to what the frame allows', () => {
    expect(barsDrag(start, { x: 0, y: 5000 }, frame, DEFAULT_OPTIONS).spacers).toBe(frame.maxSpacers);
    expect(barsDrag(start, { x: 0, y: -5000 }, frame, DEFAULT_OPTIONS).spacers).toBe(0);
  });
  it('snaps the stem to a length on offer', () => {
    expect(DEFAULT_OPTIONS.stemLengths).toEqual(expect.arrayContaining([100, 110]));
    const p = barsDrag(start, { x: 12, y: 0 }, frame, DEFAULT_OPTIONS);
    expect(p.spacers).toBe(start.spacers);
    expect(p.stemLength).toBe(110);
  });
  it('a small drag changes nothing', () => {
    expect(barsDrag(start, { x: 2, y: 1 }, frame, DEFAULT_OPTIONS)).toEqual({ spacers: 20, stemLength: 100 });
  });
});

describe('crankAngle', () => {
  it('measures degrees counterclockwise from forward', () => {
    expect(crankAngle({ x: 1, y: 0 })).toBeCloseTo(0);
    expect(crankAngle({ x: 0, y: 1 })).toBeCloseTo(90);
    expect(crankAngle({ x: -1, y: 0 })).toBeCloseTo(180);
    expect(crankAngle({ x: 0, y: -1 })).toBeCloseTo(270);
  });
});
