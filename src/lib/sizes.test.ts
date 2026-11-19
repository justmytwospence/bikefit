import { describe, expect, it } from 'vitest';
import { buildCatalog, toFrame, type BrandFile } from '../data/catalog';
import { FIXTURE } from '../data/fixture';
import type { CompareRow } from '../model/optimize';
import { TEST_FRAMES } from '../model/testFrames';
import type { Frame } from '../model/types';
import { fitScore } from '../model/score';
import { betweenSizes, catalogModelFor, groupRows, rankSizes, sizeAdviceLine, sizeEntries, sizeFamily } from './sizes';

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

/** A row whose score follows from its cost, as optimizeFit makes them. */
const row = (id: string, verdict: 'fits' | 'compromise' | 'no', cost: number) =>
  ({ frameId: id, frameName: id, result: { verdict, cost, score: fitScore(cost) } }) as CompareRow;
const cost = (score: number) => -2 * Math.log(score / 100);
/** Sizes of one model in size order, from [size, verdict, score]. */
const sizes = (...s: [string, 'fits' | 'compromise' | 'no', number][]) =>
  s.map(([size, v, score]) => ({ size, row: row(size, v, cost(score)), frame: { id: size } as Frame }));

describe('rankSizes', () => {
  it('picks the best size, leaves a clear runner-up as merely workable and writes off the far ones', () => {
    const r = rankSizes(sizes(['54', 'fits', 78], ['56', 'fits', 98], ['58', 'compromise', 64], ['61', 'no', 30]));
    expect(r.map((e) => e.standing)).toEqual(['ok', 'pick', 'far', 'no']);
    expect(betweenSizes(r)).toBeNull();
  });
  it('calls a neighbour within three points the alternative', () => {
    const r = rankSizes(sizes(['52', 'fits', 60], ['54', 'fits', 91], ['56', 'fits', 93], ['58', 'fits', 50]));
    expect(r.map((e) => e.standing)).toEqual(['far', 'alt', 'pick', 'far']);
    expect(betweenSizes(r)!.map((e) => e.size)).toEqual(['54', '56']);
  });
  it('takes the closer neighbour when both are within reach, and never one two sizes away', () => {
    const r = rankSizes(sizes(['52', 'fits', 96], ['54', 'fits', 97], ['56', 'fits', 98], ['58', 'fits', 96]));
    expect(r.map((e) => e.standing)).toEqual(['ok', 'alt', 'pick', 'ok']);
  });
  it('has no pick when nothing fits', () => {
    const r = rankSizes(sizes(['52', 'no', 20], ['54', 'no', 10]));
    expect(r.map((e) => e.standing)).toEqual(['no', 'no']);
  });
});

describe('sizeAdviceLine', () => {
  const clear = rankSizes(sizes(['54', 'fits', 78], ['56', 'fits', 98], ['58', 'compromise', 64]));
  const tie = rankSizes(sizes(['54', 'fits', 91], ['56', 'fits', 93], ['58', 'fits', 50]));
  it('says when the current size is best', () => {
    expect(sizeAdviceLine(clear, '56')).toBe('This size fits you best.');
  });
  it('says another size fits better', () => {
    expect(sizeAdviceLine(clear, '58')).toBe('Size 56 fits better.');
  });
  it('says when the rider is between sizes', () => {
    expect(sizeAdviceLine(tie, '54')).toBe('You are between sizes 54 and 56.');
    expect(sizeAdviceLine(tie, '56')).toBe('You are between sizes 54 and 56.');
    expect(sizeAdviceLine(tie, '58')).toBe('Sizes 54 and 56 fit better; you are between them.');
  });
  it('says when no size fits', () => {
    expect(sizeAdviceLine(rankSizes(sizes(['52', 'no', 20])), '52')).toBe('No size of this bike fits you.');
  });
});

describe('sizeEntries', () => {
  it('puts best-first rows back in size order and skips sizes that were not checked', () => {
    const options = ['54', '56', '58'].map((size) => ({ size, frame: { id: size } as Frame }));
    const e = sizeEntries([row('56', 'fits', cost(98)), row('54', 'fits', cost(80))], options);
    expect(e.map((x) => [x.size, x.standing])).toEqual([['54', 'ok'], ['56', 'pick']]);
  });
});

describe('groupRows', () => {
  const named = (id: string, name: string, v: 'fits' | 'compromise' | 'no', score: number) =>
    ({ ...row(id, v, cost(score)), frameName: name }) as CompareRow;
  it('merges the sizes of a model in size order and keeps the order of the rows', () => {
    const rows = [
      named('cat:t-56', 'Tarmac · 56', 'fits', 98),
      named('mine', 'My frame', 'compromise', 70),
      named('cat:t-54', 'Tarmac · 54', 'compromise', 60),
    ];
    const frames = [{ id: 'cat:t-54' }, { id: 'cat:t-56' }, { id: 'mine' }] as Frame[];
    const groups = groupRows(rows, frames);
    expect(groups.map((g) => g.name)).toEqual(['Tarmac', 'My frame']);
    expect(groups[0].sizes.map((s) => [s.size, s.standing])).toEqual([['54', 'far'], ['56', 'pick']]);
    expect(groups[0].sizes[0].frame).toBe(frames[0]);
    expect(groups[0].best.frameId).toBe('cat:t-56');
    expect(groups[1].key).toBe('f:mine');
    expect(groups[1].sizes.map((s) => s.size)).toEqual(['']);
  });
  it('leads a model with its lowest cost, but never with a size that does not fit', () => {
    const frames = [{ id: 'cat:t-58' }, { id: 'cat:t-61' }] as Frame[];
    const [g] = groupRows([named('cat:t-61', 'Aethos · 61', 'compromise', 95), named('cat:t-58', 'Aethos · 58', 'fits', 90)], frames);
    expect(g.best.frameId).toBe('cat:t-61');
    const [h] = groupRows([named('cat:t-61', 'Aethos · 61', 'no', 95), named('cat:t-58', 'Aethos · 58', 'compromise', 90)], frames);
    expect(h.best.frameId).toBe('cat:t-58');
  });
  it('leads with a size even when none fits', () => {
    const [g] = groupRows([named('cat:t-61', 'Aethos · 61', 'no', 20), named('cat:t-58', 'Aethos · 58', 'no', 30)], [{ id: 'cat:t-58' }, { id: 'cat:t-61' }] as Frame[]);
    expect(g.best.frameId).toBe('cat:t-58');
  });
});
