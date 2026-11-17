import { describe, expect, it } from 'vitest';
import { buildCatalog, toFrame, type BrandFile } from '../data/catalog';
import { FIXTURE } from '../data/fixture';
import type { CompareRow } from '../model/optimize';
import { EXAMPLE_FRAMES } from '../model/presets';
import { catalogModelFor, sizeFamily, sizeVerdictLine } from './sizes';

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
    const file: BrandFile = { brand: 'Solo', models: [{ ...tarmac, model: 'One', sizes: [tarmac.sizes[0]] }] };
    const one = buildCatalog([file]);
    expect(sizeFamily(toFrame(one[0], one[0].sizes[0]), one, toFrame)).toBeNull();
    expect(sizeFamily(EXAMPLE_FRAMES[0], FIXTURE, toFrame)).toBeNull();
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
