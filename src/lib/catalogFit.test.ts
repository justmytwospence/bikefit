import { describe, expect, it } from 'vitest';
import { toFrame } from '../data/catalog';
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
  it('lists every model once with all its sizes', () => {
    const jobs = screenCatalog(FIXTURE, toFrame, DEFAULT_COMPONENTS, hoodsOf(0));
    expect(jobs.length).toBe(FIXTURE.length);
    for (const m of FIXTURE) {
      const j = jobs.find((x) => x.modelId === m.id)!;
      expect(j.frames.length).toBe(m.sizes.length);
      expect(j.start).toBeGreaterThanOrEqual(0);
      expect(j.start).toBeLessThan(m.sizes.length);
    }
  });
  it('starts at the size nearest the ideal hoods', () => {
    const j = screenCatalog(FIXTURE, toFrame, DEFAULT_COMPONENTS, hoodsOf(3)).find((x) => x.modelId === tarmac.id)!;
    expect(j.start).toBe(3);
    expect(j.dist).toBeCloseTo(0, 6);
  });
  it('sorts nearest first', () => {
    const d = screenCatalog(FIXTURE, toFrame, DEFAULT_COMPONENTS, hoodsOf(3)).map((x) => x.dist);
    expect(d).toEqual([...d].sort((a, b) => a - b));
  });
});
