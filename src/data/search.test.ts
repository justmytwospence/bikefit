import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { FIXTURE as M } from './fixture';
import { editDistance, groupByBrand, searchCatalog } from './search';

describe('searchCatalog', () => {
  it('finds a model despite a typo and picks the size', () => {
    const [h] = searchCatalog(M, 'tarmc sl8 56');
    expect(h.model.model).toBe('Tarmac SL8');
    expect(h.size).toBe('56');
  });
  it('ignores accents', () => {
    for (const q of ['emonda', 'Émonda']) expect(searchCatalog(M, q)[0].model.brand).toBe('Trek');
    expect(searchCatalog(M, 'cervelo aspero')[0].model.brand).toBe('Cervélo');
  });
  it('combines brand and category words', () => {
    const r = searchCatalog(M, 'giant gravel');
    expect(r.map((h) => h.model.model)).toEqual(['Revolt']);
  });
  it('filters by category on an empty query', () => {
    expect(searchCatalog(M, '', 'gravel')).toHaveLength(3);
  });
  it('groups by brand', () => {
    const g = groupByBrand(searchCatalog(M, 'specialized'));
    expect(g).toHaveLength(1);
    expect(g[0].brand).toBe('Specialized');
    expect(g[0].hits).toHaveLength(2);
  });
  it('requires every token to match', () => {
    expect(searchCatalog(M, 'zzzz')).toEqual([]);
    expect(searchCatalog(M, 'tarmac qqqq')).toEqual([]);
  });
});

describe('editDistance', () => {
  it('counts edits and transpositions', () => {
    expect(editDistance('tarmc', 'tarmac', 1)).toBe(1);
    expect(editDistance('teh', 'the', 1)).toBe(1);
    expect(editDistance('abcdef', 'uvwxyz', 1)).toBe(2);
  });
});

describe('real catalog', () => {
  it.skip('finds the Tarmac under Specialized', () => {
    expect(searchCatalog(CATALOG, 'tarmac')[0].model.brand).toBe('Specialized');
  });
});
