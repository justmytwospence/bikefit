import { describe, expect, it } from 'vitest';
import { parseValue } from './numbers';

describe('parseValue', () => {
  it('reads angles with a decimal comma', () => expect(parseValue('seatTubeAngle', '73,5°')).toBe(73.5));
  it('reads metres', () => expect(parseValue('wheelbase', '1.003')).toBe(1003));
  it('reads centimetres', () => expect(parseValue('stack', '57.3')).toBe(573));
  it('reads inches', () => expect(parseValue('reach', '22.5"')).toBe(572));
  it('keeps millimetres and bb drop', () => {
    expect(parseValue('bbDrop', '72')).toBe(72);
    expect(parseValue('headTubeLength', '99 mm')).toBe(99);
    expect(parseValue('stack', '501mm')).toBe(501);
  });
  it('returns null without a number', () => expect(parseValue('stack', 'n/a')).toBeNull());
});
