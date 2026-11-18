import { describe, expect, it } from 'vitest';
import { buildCatalog, toFrame, type BrandFile } from '../data/catalog';
import { FIXTURE } from '../data/fixture';
import type { CompareRow } from '../model/optimize';
import { TEST_FRAMES } from '../model/testFrames';
import type { Frame } from '../model/types';
import { catalogModelFor, groupRows, sizeFamily, sizeVerdictLine } from './sizes';

const tarmac = FIXTURE.find((m) => m.model === 'Tarmac SL8')!;

describe('catalogModelFor', () => {
  it('finds the model of a catalog frame and nothing for others', () => {
    expect(catalogModelFor(toFrame(tarmac, tarmac.sizes[2]).id, FIXTURE)).toBe(tarmac);
    expect(catalogModelFor('endurance-56', FIXTURE)).toBeNull();
    expect(catalogModelFor('0b0f5c1e-2f5d-4d1c-9a43-0123456789ab', FIXTURE)).toBeNull();
  });
});

describe('sizeFamily', () => {
  it('lists every size and keeps the saved frame for its own size', () => {
    const mine = { ...toFrame(tarmac, tarmac.sizes[2]), stack: 999 };
    const fam = sizeFamily(mine, FIXTURE, toFrame)!;
    expect(fam.map((o) => o.size)).toEqual(tarmac.sizes.map((s) => s.size));
    expect(fam[2].frame).toBe(mine);
    expect(fam[2].frame.stack).toBe(999);
    expect(fam[1].frame.stack).not.toBe(999);
  });
  it('is null for one-size models and custom frames', () => {
    const file: BrandFile = { brand: 'Solo', models: [{ ...tarmac, model: 'One', sizes: [['S', 520, 370, 73.5, 73, 140, 520, 410, 990, 72]] }] };
    const one = buildCatalog([file]);
    expect(sizeFamily(toFrame(one[0], one[0].sizes[0]), one, toFrame)).toBeNull();
    expect(sizeFamily(TEST_FRAMES[0], FIXTURE, toFrame)).toBeNull();
  });
});

const row = (id: string, verdict: 'fits' | 'compromise' | 'no', cost: number) =>
  ({ frameId: id, frameName: id, result: { verdict, cost } }) as CompareRow;

describe('sizeVerdictLine', () => {
  const sizeOf = (id: string) => id.toUpperCase();
  it('says when the current size is best', () => {
    expect(sizeVerdictLine([row('a', 'fits', 1), row('b', 'fits', 2)], 'a', sizeOf)).toBe('This size fits you best.');
  });
  it('says another size fits better', () => {
    expect(sizeVerdictLine([row('b', 'fits', 1), row('a', 'compromise', 2)], 'a', sizeOf)).toBe('Size B fits better.');
  });
  it('says closer fit when the verdicts match', () => {
    expect(sizeVerdictLine([row('b', 'fits', 1), row('a', 'fits', 2)], 'a', sizeOf)).toBe('Size B is a closer fit.');
  });
});

describe('groupRows', () => {
  it('merges the sizes of a model and keeps the best-first order', () => {
    const named = (id: string, name: string, v: 'fits' | 'compromise' | 'no', cost: number) =>
      ({ ...row(id, v, cost), frameName: name }) as CompareRow;
    const rows = [
      named('cat:t-56', 'Tarmac · 56', 'fits', 1),
      named('mine', 'My frame', 'compromise', 2),
      named('cat:t-54', 'Tarmac · 54', 'compromise', 3),
    ];
    const frames = [{ id: 'cat:t-54' }, { id: 'cat:t-56' }, { id: 'mine' }] as Frame[];
    const groups = groupRows(rows, frames);
    expect(groups.map((g) => g.name)).toEqual(['Tarmac', 'My frame']);
    expect(groups[0].sizes.map((s) => s.size)).toEqual(['54', '56']);
    expect(groups[0].best.frameId).toBe('cat:t-56');
    expect(groups[1].key).toBe('f:mine');
    expect(groups[1].sizes.map((s) => s.size)).toEqual(['']);
  });
  it('leads a model with its best verdict even when another size has a lower cost', () => {
    const named = (id: string, name: string, v: 'fits' | 'compromise' | 'no', cost: number) =>
      ({ ...row(id, v, cost), frameName: name }) as CompareRow;
    const rows = [named('cat:t-61', 'Aethos · 61', 'compromise', 0.1), named('cat:t-58', 'Aethos · 58', 'fits', 0.2)];
    const [g] = groupRows(rows, [{ id: 'cat:t-58' }, { id: 'cat:t-61' }] as Frame[]);
    expect(g.best.frameId).toBe('cat:t-58');
  });
});
