import { describe, expect, it } from 'vitest';
import { keyFor } from './labels';

describe('keyFor', () => {
  it('maps common labels', () => {
    expect(keyFor('Seat Tube Angle (°)')).toBe('seatTubeAngle');
    expect(keyFor('A. Stack')).toBe('stack');
    expect(keyFor('K Stack (mm) (inch)')).toBe('stack');
    expect(keyFor('Sitzrohrlänge')).toBe('seatTubeLength');
    expect(keyFor('Seat tube')).toBe('seatTubeLength');
    expect(keyFor('Head Tube Length')).toBe('headTubeLength');
    expect(keyFor('BB Drop (mm)')).toBe('bbDrop');
    expect(keyFor('Frame Stack')).toBe('stack');
    expect(keyFor('Frame Reach')).toBe('reach');
  });
  it('rejects look-alikes', () => {
    expect(keyFor('Effective Stack')).toBeNull();
    expect(keyFor('Effective Reach')).toBeNull();
    expect(keyFor('Stack to Stem')).toBeNull();
    expect(keyFor('Reach to Stem')).toBeNull();
    expect(keyFor('Top Tube Length')).toBeNull();
    expect(keyFor('Standover Height')).toBeNull();
    expect(keyFor('Crank Length')).toBeNull();
  });
});
