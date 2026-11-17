import { describe, expect, it } from 'vitest';
import { buildCatalog, toFrame, type BrandFile } from '../data/catalog';
import { FIXTURE } from '../data/fixture';
import { forwardLayout } from '../model/geometry';
import { DEFAULT_COMPONENTS, DEFAULT_PARAMS } from '../model/presets';
import { screenCatalog } from './catalogFit';

const tarmac = FIXTURE.find((m) => m.model === 'Tarmac SL8')!;
const hoodsOf = (i: number) => {
  const f = toFrame(tarmac, tarmac.sizes[i]);
  return forwardLayout(f, DEFAULT_COMPONENTS, { ...DEFAULT_PARAMS, spacers: Math.min(DEFAULT_PARAMS.spacers, f.maxSpacers) }).hoods;
};

describe('screenCatalog', () => {
  it('keeps at most two sizes per model, in catalog order', () => {
    const c = screenCatalog(FIXTURE, toFrame, DEFAULT_COMPONENTS, hoodsOf(0));
    for (const m of FIXTURE) {
      const mine = c.filter((x) => x.modelId === m.id);
      expect(mine.length).toBe(Math.min(2, m.sizes.length));
      const idx = mine.map((x) => m.sizes.findIndex((s) => s.size === x.size));
      expect(idx).toEqual([...idx].sort((a, b) => a - b));
    }
  });
  it('picks the sizes nearest the ideal hoods', () => {
    const c = screenCatalog(FIXTURE, toFrame, DEFAULT_COMPONENTS, hoodsOf(3)).filter((x) => x.modelId === tarmac.id);
    expect(c.map((x) => x.size)).toContain(tarmac.sizes[3].size);
    expect([tarmac.sizes[2].size, tarmac.sizes[4].size]).toContain(c.find((x) => x.size !== tarmac.sizes[3].size)!.size);
  });
  it('perModel 1 gives one per model and one-size models keep their size', () => {
    const solo: BrandFile = { brand: 'Solo', models: [{ ...tarmac, model: 'One', sizes: [tarmac.sizes[0]] }] };
    const models = [...FIXTURE, ...buildCatalog([solo])];
    const c = screenCatalog(models, toFrame, DEFAULT_COMPONENTS, hoodsOf(0), 1);
    expect(c.length).toBe(models.length);
    expect(c.find((x) => x.modelId.startsWith('solo'))!.size).toBe(tarmac.sizes[0].size);
  });
});
