import { describe, expect, it } from 'vitest';
import { shoeLabel } from './riding';

describe('shoeLabel', () => {
  it('shows one sizing system, following the units setting', () => {
    expect(shoeLabel(43, 'metric')).toBe('EU 43');
    expect(shoeLabel(43, 'imperial')).toBe("US 9.5 (men's)");
    expect(shoeLabel(42.5, 'metric')).toBe('EU 42.5');
    expect(shoeLabel(42.5, 'imperial')).toBe("US 9 (men's)");
  });
});
