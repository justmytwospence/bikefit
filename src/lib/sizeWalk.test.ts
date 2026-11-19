import { describe, expect, it } from 'vitest';
import type { CompareRow } from '../model/optimize';
import type { Verdict } from '../model/verdict';
import { walkSizes } from './sizeWalk';

function run(verdicts: Verdict[], start: number) {
  const calls: number[] = [];
  const rows = walkSizes(verdicts.length, start, (i) => {
    calls.push(i);
    return { frameId: `f${i}`, frameName: `f${i}`, result: { verdict: verdicts[i] } } as unknown as CompareRow;
  });
  return { calls: calls.sort((a, b) => a - b), ids: rows.map((r) => r.frameId) };
}

describe('walkSizes', () => {
  it('stops each direction at the first size that does not fit', () => {
    const r = run(['no', 'fits', 'fits', 'fits', 'no', 'no'], 2);
    expect(r.calls).toEqual([0, 1, 2, 3, 4]);
    expect(r.ids).toEqual(['f0', 'f1', 'f2', 'f3', 'f4']);
  });
  it('walks right from the first size while sizes fit', () => {
    expect(run(['fits', 'fits', 'compromise', 'no', 'fits'], 0).calls).toEqual([0, 1, 2, 3]);
  });
  it('checks the neighbours even when the start does not fit', () => {
    expect(run(['no', 'no', 'no', 'no'], 1).calls).toEqual([0, 1, 2]);
  });
  it('always checks both neighbours', () => {
    expect(run(['fits', 'no', 'fits'], 1).calls).toEqual([0, 1, 2]);
  });
  it('handles a single size', () => {
    expect(run(['fits'], 0).calls).toEqual([0]);
  });
});
