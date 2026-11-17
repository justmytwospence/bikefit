import { describe, expect, it } from 'vitest';
import { fitScore, metricCost, status } from './score';
import { STYLES } from './styles';
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
