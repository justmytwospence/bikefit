import { describe, expect, it } from 'vitest';
import { feetInches, fromDisplay, fromFeetInches, lengthField, toDisplay } from './units';

describe('units', () => {
  it('splits height into feet and inches', () => {
    expect(feetInches(1780)).toEqual({ ft: 5, inch: 10 });
    expect(feetInches(1828.8)).toEqual({ ft: 6, inch: 0 });
    expect(fromFeetInches(5, 10)).toBeCloseTo(1778, 6);
  });
  it('shows body lengths in cm/mm or inches', () => {
    const cm = lengthField('metric', 'cm', 600, 1050);
    expect([cm.unit, cm.min, cm.max]).toEqual(['cm', 60, 105]);
    expect(toDisplay(840, cm)).toBe(84);
    const inch = lengthField('imperial', 'cm', 600, 1050);
    expect(inch.unit).toBe('in');
    expect(toDisplay(840, inch)).toBe(33);
    expect(fromDisplay(33, inch)).toBeCloseTo(838.2, 6);
    expect(toDisplay(437.9, lengthField('imperial', 'mm', 50, 900))).toBe(17.2);
    expect(toDisplay(437.9, lengthField('metric', 'mm', 50, 900))).toBe(440);
  });
});
