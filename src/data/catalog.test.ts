import { describe, expect, it } from 'vitest';
import {
  buildCatalog, CATALOG, CATEGORIES, GEOMETRY_KEYS, slug, toFrame, type BrandFile,
} from './catalog';
import { FIXTURE, FIXTURE_FILES } from './fixture';

describe('buildCatalog', () => {
  const tarmac = FIXTURE.find((m) => m.model === 'Tarmac SL8')!;
  it('fills defaults, keeps overrides and builds ids', () => {
    expect(tarmac.id).toBe('specialized-tarmac-sl8-2024');
    expect(tarmac.tyreWidth).toBe(28);
    expect(FIXTURE.find((m) => m.model === 'Diverge')!.tyreWidth).toBe(47);
  });
  it('slugs accents', () => expect(slug('Cervélo')).toBe('cervelo'));
  it('rejects duplicate ids', () => {
    const dup: BrandFile[] = [FIXTURE_FILES[0], FIXTURE_FILES[0]];
    expect(() => buildCatalog(dup)).toThrow('Duplicate catalog id');
  });
  it('converts a size to a frame', () => {
    const f = toFrame(tarmac, tarmac.sizes.find((s) => s.size === '56')!);
    expect(f.id).toBe('cat:specialized-tarmac-sl8-2024-56');
    expect(f.name).toBe('Specialized Tarmac SL8 2024 · 56');
    expect(f.maxSpacers).toBe(30);
  });
});

const RANGES: Record<(typeof GEOMETRY_KEYS)[number], [number, number]> = {
  stack: [400, 800], reach: [300, 500], seatTubeAngle: [65, 80], headTubeAngle: [65, 80],
  headTubeLength: [80, 260], seatTubeLength: [330, 650], chainstay: [380, 470],
  wheelbase: [900, 1200], bbDrop: [40, 90],
};

describe('real catalog', () => {
  it.skip('is big enough', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(100);
    expect(new Set(CATALOG.map((m) => m.brand)).size).toBeGreaterThanOrEqual(30);
  });
  it('has valid entries', () => {
    const cats = CATEGORIES.map((c) => c.value);
    const errs: string[] = [];
    for (const m of CATALOG) {
      const bad = (msg: string) => errs.push(`${m.id}: ${msg}`);
      if (!m.source.startsWith('https://')) bad('source');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(m.retrieved)) bad('retrieved');
      if (m.year < 2015 || m.year > 2027) bad('year');
      if (!cats.includes(m.category)) bad('category');
      if (m.sizes.length < 2) bad('needs 2 sizes');
      if (new Set(m.sizes.map((s) => s.size)).size !== m.sizes.length) bad('duplicate size labels');
      if (m.estimated.some((k) => !GEOMETRY_KEYS.includes(k))) bad('estimated key');
      if (!(m.tyreWidth >= 23 && m.tyreWidth <= 60)) bad('tyreWidth');
      if (!(m.maxSpacers >= 0 && m.maxSpacers <= 80)) bad('maxSpacers');
      m.sizes.forEach((s, i) => {
        for (const k of GEOMETRY_KEYS) {
          const [lo, hi] = RANGES[k];
          if (!Number.isFinite(s[k]) || s[k] < lo || s[k] > hi) bad(`${s.size} ${k}=${s[k]}`);
        }
        const p = m.sizes[i - 1];
        if (p) {
          if (s.stack < p.stack - 3) bad(`${s.size} stack drops`);
          if (s.reach < p.reach - 10) bad(`${s.size} reach drops`);
        }
      });
      if (m.sizes.length > 1 && m.sizes[m.sizes.length - 1].reach <= m.sizes[0].reach) bad('reach not increasing');
    }
    expect(errs).toEqual([]);
  });
});
