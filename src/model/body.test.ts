import { describe, expect, it } from 'vitest';
import { resolveSegments } from './body';
import { DEFAULT_BODY } from './presets';

describe('resolveSegments', () => {
  it('estimates segments from height and inseam', () => {
    const s = resolveSegments(DEFAULT_BODY);
    expect(s.femur).toBeCloseTo((0.245 * 840) / 0.47, 1);
    expect(s.femur).toBeCloseTo(437.87, 1);
    expect(s.torso).toBeCloseTo(512.64, 2);
  });
  it('applies valid overrides and ignores invalid ones', () => {
    const s = resolveSegments({ ...DEFAULT_BODY, overrides: { femur: 450, tibia: 0, torso: NaN } });
    expect(s.femur).toBe(450);
    expect(s.tibia).toBeCloseTo(0.246 * 1780 * (840 / (0.47 * 1780)), 6);
    expect(s.torso).toBeCloseTo(512.64, 2);
  });
});
