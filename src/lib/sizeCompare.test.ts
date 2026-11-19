import { describe, expect, it } from 'vitest';
import type { CompareRow } from '../model/optimize';
import { DEFAULT_PARAMS } from '../model/presets';
import { TEST_FRAMES } from '../model/testFrames';
import type { FitParams } from '../model/types';
import type { FitFacts } from '../model/verdict';
import { compareSizes } from './sizeCompare';
import type { SizeEntry } from './sizes';

const entry = (size: string, wheelbase: number, params: Partial<FitParams>, facts: Partial<FitFacts>): SizeEntry => ({
  size,
  standing: 'pick',
  frame: { ...TEST_FRAMES[0], id: size, wheelbase, maxSpacers: 30 },
  row: {
    frameId: size, frameName: size,
    result: {
      params: { ...DEFAULT_PARAMS, ...params },
      facts: { barDrop: 70, standover: 40, seatpost: 200, toeClearance: 30, offIdeal: null, stockRange: null, ...facts },
    },
  } as CompareRow,
});

describe('compareSizes', () => {
  const small = entry('54', 978, { stemLength: 110, stemAngle: -6, spacers: 25 }, { seatpost: 262, standover: 48, toeClearance: 4 });
  const large = entry('56', 991, { stemLength: 100, stemAngle: -6, spacers: 5 }, { seatpost: 241, standover: 27, toeClearance: 16 });
  const c = compareSizes(small, large);
  const line = (label: string) => c.lines.find((l) => l.label === label)!;

  it('lists the build and what is left to adjust on each size', () => {
    expect(c.sizes).toEqual(['54', '56']);
    expect(line('Stem').values).toEqual(['110 mm −6°', '100 mm −6°']);
    expect(line('Room to lower the bars')).toMatchObject({ values: ['25 mm', '5 mm'], better: 0 });
    expect(line('Room to raise the bars')).toMatchObject({ values: ['5 mm', '25 mm'], better: 1 });
  });
  it('lists clearances and marks the roomier side', () => {
    expect(line('Seatpost showing').values).toEqual(['262 mm', '241 mm']);
    expect(line('Standover clearance')).toMatchObject({ values: ['48 mm', '27 mm'], better: 0 });
    expect(line('Toe and front wheel')).toMatchObject({ values: ['4 mm clear', '16 mm clear'], better: 1 });
    expect(line('Wheelbase').values).toEqual(['978 mm', '991 mm']);
  });
  it('sums each size up in a sentence', () => {
    expect(c.gist[0]).toBe('54 is the smaller, lower frame: 25 mm of spacers you can take out to go lower, more seatpost showing, quicker steering.');
    expect(c.gist[1]).toBe('56 is the larger, taller frame: 25 mm of spacers you can add to come up, steadier steering.');
  });
  it('leaves the toe line out when both sizes clear the wheel easily, and says tight for no standover', () => {
    const a = entry('54', 990, {}, { toeClearance: 40, standover: -5 });
    const b = entry('56', 991, {}, { toeClearance: 45, standover: -20 });
    const d = compareSizes(a, b);
    expect(d.lines.some((l) => l.label === 'Toe and front wheel')).toBe(false);
    expect(d.lines.find((l) => l.label === 'Standover clearance')!.values).toEqual(['tight', 'tight']);
    expect(d.gist[0]).not.toContain('steering');
  });
});
