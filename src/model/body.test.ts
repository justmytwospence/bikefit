import { describe, expect, it } from 'vitest';
import { effectiveShoeSize, resolveSegments, suggestShoeSize } from './body';
import { DEFAULT_BODY } from './presets';
import { TEST_BODY } from './testFrames';

describe('resolveSegments', () => {
  it('estimates segments from height and inseam', () => {
    const s = resolveSegments(TEST_BODY);
    expect(s.femur).toBeCloseTo(437.87, 1);
    expect(s.torso).toBeCloseTo(512.64, 2);
  });
  it('derives foot length from shoe size, not height', () => {
    const own = { ...DEFAULT_BODY, shoeSizeAuto: false };
    const s = resolveSegments({ ...own, shoeSize: 43 });
    expect(s.footLength).toBeCloseTo(269.67, 2);
    expect(s.footBack).toBeCloseTo(0.55 * 269.67, 1);
    expect(resolveSegments({ ...own, shoeSize: 43, height: 1600 }).footLength).toBeCloseTo(269.67, 2);
    expect(resolveSegments({ ...own, shoeSize: 46 }).footLength).toBeCloseTo(289.67, 2);
  });
  it('scales the arm from a measured arm length; overrides still win', () => {
    const s = resolveSegments({ ...TEST_BODY, armLength: 700 });
    expect(s.upperArm + s.forearmGrip).toBeCloseTo(700, 6);
    expect(resolveSegments({ ...TEST_BODY, armLength: 700, overrides: { upperArm: 350 } }).upperArm).toBe(350);
    const f = resolveSegments({ ...TEST_BODY, sex: 'female', armLength: 650 });
    expect(f.upperArm + f.forearmGrip).toBeCloseTo(650, 6);
  });
  it('applies valid overrides and ignores invalid ones', () => {
    const s = resolveSegments({ ...TEST_BODY, overrides: { femur: 450, tibia: 0, torso: NaN } });
    expect(s.femur).toBe(450);
    expect(s.tibia).toBeCloseTo(0.246 * 1780 * (840 / (0.47 * 1780)), 6);
    expect(s.torso).toBeCloseTo(512.64, 2);
  });
  it('pelvic share follows flexibility', () => {
    const share = (f: 'low' | 'medium' | 'high') => resolveSegments({ ...TEST_BODY, flexibility: f }).pelvicShare;
    expect([share('low'), share('medium'), share('high')]).toEqual([0.35, 0.5, 0.6]);
  });
  it('female proportions scale from the male ones', () => {
    const m = resolveSegments(TEST_BODY);
    const f = resolveSegments({ ...TEST_BODY, sex: 'female' });
    expect(f.torso).toBeCloseTo(m.torso * 0.978, 6);
    expect(f.forearmGrip).toBeCloseTo(m.forearmGrip * 0.982, 6);
    expect(f.femur).toBeCloseTo(m.femur * 0.989, 6);
    expect(f.upperArm).toBe(m.upperArm);
  });
});

describe('suggested shoe size', () => {
  it('follows sex and height', () => {
    expect(suggestShoeSize('male', 1780)).toBe(43.5);
    expect(suggestShoeSize('female', 1650)).toBe(40);
    expect(suggestShoeSize('male', 1650)).toBe(41);
    expect(suggestShoeSize('male', 1000)).toBe(36);
    expect(suggestShoeSize('male', 2600)).toBe(50);
  });
  it('is used until a size is chosen', () => {
    expect(effectiveShoeSize({ ...DEFAULT_BODY, height: 1650 })).toBe(41);
    expect(effectiveShoeSize({ ...DEFAULT_BODY, height: 1650, shoeSizeAuto: false, shoeSize: 45 })).toBe(45);
  });
});
