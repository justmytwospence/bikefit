import { describe, expect, it } from 'vitest';
import { forwardLayout } from './geometry';
import { evaluateFit } from './pose';
import { DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS } from './presets';
import { makeContext, poseWeights } from './riding';
import { crankFor, cranksNear, fitCost, fitScore, metricCost, partPenalty, scoreBreakdown, status } from './score';
import { TEST_BODY, TEST_FRAMES } from './testFrames';
import { resolveSegments } from './body';
import { bandsFor, STYLES } from './styles';
import type { Band } from './types';

const band: Band = { min: 40, max: 50, weight: 1, scale: 5, center: 0.05, unit: '°' };

describe('score', () => {
  it('metricCost is minimal at the midpoint and grows outside', () => {
    expect(metricCost(45, band)).toBe(0);
    const a = metricCost(55, band);
    const b = metricCost(60, band);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a * 3);
  });
  it('status boundaries', () => {
    expect(status(50, band)).toBe('ok');
    expect(status(55, band)).toBe('near');
    expect(status(55.1, band)).toBe('off');
    expect(status(40, band)).toBe('ok');
  });
  it('weight 0 is informational and free', () => {
    const info = { ...band, weight: 0 };
    expect(status(100, info)).toBe('info');
    expect(metricCost(100, info)).toBe(0);
  });
  it('center 0 costs nothing anywhere in band', () => {
    const flat = { ...band, center: 0 };
    expect(metricCost(41, flat)).toBe(0);
    expect(metricCost(49, flat)).toBe(0);
  });
  it('fitScore(0) is 100', () => expect(fitScore(0)).toBe(100));
  it('elbow is informational in every style', () => {
    for (const s of Object.values(STYLES)) for (const p of s.poses) expect(p.bands.elbow!.weight).toBe(0);
  });
});

describe('scoreBreakdown', () => {
  const frame = TEST_FRAMES.find((f) => f.id === 'endurance-56')!;
  const seg = resolveSegments(TEST_BODY);
  const targets = bandsFor(STYLES.endurance, 'medium');
  const weights = poseWeights('hoods');
  const run = (p = DEFAULT_PARAMS) => {
    const ev = evaluateFit(seg, forwardLayout(frame, DEFAULT_COMPONENTS, p), makeContext(frame, DEFAULT_COMPONENTS, 'neutral', 'easy'), targets);
    return { ev, b: scoreBreakdown(ev, targets, weights, p, crankFor(TEST_BODY.inseam)) };
  };
  it('adds up to fitCost plus partPenalty', () => {
    const { ev, b } = run();
    const total = fitCost(ev, targets, weights) + partPenalty(DEFAULT_PARAMS, crankFor(TEST_BODY.inseam));
    expect(b.parts.reduce((a, x) => a + x.cost, 0)).toBeCloseTo(total, 9);
    expect(b.score).toBe(fitScore(total));
    expect(b.parts.reduce((a, x) => a + x.points, 0)).toBeCloseTo(100 - b.score, 9);
  });
  it('an unreachable saddle shows up as legShort', () => {
    const { b } = run({ ...DEFAULT_PARAMS, saddleHeight: 900 });
    expect(b.parts[0].id).toBe('legShort');
  });
});

describe('cranks in proportion to the legs', () => {
  it('crankFor is 20.5% of inseam within 150 to 175', () => {
    expect(crankFor(840)).toBeCloseTo(172.2, 6);
    expect(crankFor(690)).toBe(150);
    expect(crankFor(930)).toBe(175);
  });
  it('cranksNear offers the nearest length and one either side, plus the one in use', () => {
    const o = DEFAULT_OPTIONS.crankLengths;
    expect(o).toEqual([150, 155, 160, 165, 170, 172.5, 175]);
    expect(cranksNear(o, 840)).toEqual([170, 172.5, 175]);
    expect(cranksNear(o, 720)).toEqual([150, 155]);
    expect(cranksNear(o, 930)).toEqual([172.5, 175]);
    expect(cranksNear(o, 770)).toEqual([155, 160, 165]);
    expect(cranksNear(o, 720, 172.5)).toEqual([150, 155, 172.5]);
    expect(cranksNear(o, 840, 172.5)).toEqual([170, 172.5, 175]);
  });
  it('partPenalty charges the distance from the proportional length, and nothing for a short crank as such', () => {
    const at = (crankLength: number, ref: number) => partPenalty({ ...DEFAULT_PARAMS, crankLength }, ref);
    expect(at(172.5, 172.5)).toBeCloseTo(0, 9);
    expect(at(150, 150)).toBeCloseTo(0, 9);
    expect(at(160, 150)).toBeCloseTo(0.016, 9);
    expect(at(172.5, 150)).toBeCloseTo(0.081, 9);
    expect(at(165, 172.5)).toBeCloseTo(0.0045, 9);
    expect(at(150, 172.5)).toBeLessThan(0.05);
  });
});
