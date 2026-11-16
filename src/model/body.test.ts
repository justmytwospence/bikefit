import { describe, expect, it } from 'vitest';
import { resolveSegments } from './body';
import { DEFAULT_BODY } from './presets';

describe('resolveSegments', () => {
  it('estimates segments from height and inseam', () => {
    const s = resolveSegments(DEFAULT_BODY);
    expect(s.femur).toBeCloseTo(437.87, 1);
    expect(s.torso).toBeCloseTo(512.64, 2);
    expect(s.footLength).toBeCloseTo(270.56, 2);
    expect(s.footBack).toBeCloseTo(148.81, 2);
  });
  it('derives foot length from shoe size', () => {
    expect(resolveSegments({ ...DEFAULT_BODY, shoeSize: 43 }).footLength).toBeCloseTo(269.67, 2);
  });
  it('scales the arm from a measured arm length; overrides still win', () => {
    const s = resolveSegments({ ...DEFAULT_BODY, armLength: 700 });
    expect(s.upperArm + s.forearmGrip).toBeCloseTo(700, 6);
    expect(resolveSegments({ ...DEFAULT_BODY, armLength: 700, overrides: { upperArm: 350 } }).upperArm).toBe(350);
  });
  it('applies valid overrides and ignores invalid ones', () => {
    const s = resolveSegments({ ...DEFAULT_BODY, overrides: { femur: 450, tibia: 0, torso: NaN } });
    expect(s.femur).toBe(450);
    expect(s.tibia).toBeCloseTo(0.246 * 1780 * (840 / (0.47 * 1780)), 6);
    expect(s.torso).toBeCloseTo(512.64, 2);
  });
  it('pelvic share follows flexibility', () => {
    const share = (f: 'low' | 'medium' | 'high') => resolveSegments({ ...DEFAULT_BODY, flexibility: f }).pelvicShare;
    expect([share('low'), share('medium'), share('high')]).toEqual([0.35, 0.5, 0.6]);
  });
});
