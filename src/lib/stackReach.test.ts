import { describe, expect, it } from 'vitest';
import type { CompareRow } from '../model/optimize';
import type { Frame } from '../model/types';
import type { ModelGroup, SizeEntry } from './sizes';
import { chartPoints, idealFrame, inArea } from './stackReach';

function group(id: string, reach: number, stack: number, off: { x: number; y: number } | null): ModelGroup {
  const frame = { id, reach, stack } as Frame;
  // The hoods land `off` from the ideal with all spacers out (low) and in (high): a flat range at `off`.
  const range = off ? { low: off, high: off, share: 0.5 } : null;
  const row = { frameId: id, frameName: id, result: { verdict: 'fits', score: 90, facts: { stockRange: range } } } as unknown as CompareRow;
  const entry = { size: '56', row, frame, standing: 'pick' } as SizeEntry;
  return { key: id, name: id, sizes: [entry], best: row };
}

describe('stack and reach chart', () => {
  it('chartPoints uses each group\'s best size', () => {
    const [p] = chartPoints([group('a', 390, 570, null)]);
    expect(p).toMatchObject({ key: 'a', reach: 390, stack: 570, verdict: 'fits', score: 90 });
  });
  it('idealFrame is the median of the frames\' implied points', () => {
    const f = idealFrame([
      group('a', 390, 570, { x: 10, y: 20 }),
      group('b', 400, 580, { x: 0, y: 0 }),
      group('c', 380, 560, { x: -10, y: -20 }),
    ])!;
    // 380, 400, 390 and 550, 580, 580 -> medians
    expect(f).toEqual({ reach: 390, stack: 580 });
  });
  it('idealFrame is null without ideals', () => {
    expect(idealFrame([group('a', 390, 570, null)])).toBeNull();
  });
  it('inArea normalises reversed ranges', () => {
    const a = { reach: [400, 380] as [number, number], stack: [600, 560] as [number, number] };
    expect(inArea({ reach: 390, stack: 570 }, a)).toBe(true);
    expect(inArea({ reach: 380, stack: 600 }, a)).toBe(true);
    expect(inArea({ reach: 379, stack: 570 }, a)).toBe(false);
  });
});
