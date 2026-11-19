import { describe, expect, it } from 'vitest';
import {
  buildCatalog, CATALOG, CATEGORIES, GEOMETRY_KEYS, RANGES, slug, toFrame, yearLabel, type BrandFile,
} from './catalog';
import { DEFAULT_FRAME } from '../model/presets';
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
  it('labels a year range', () => {
    expect(yearLabel({ year: 2020, lastYear: 2024 })).toBe('2020–2024');
    expect(yearLabel(tarmac)).toBe('2024');
  });
  it('rejects a malformed size row', () => {
    const bad: BrandFile = { brand: 'X', models: [{ ...FIXTURE_FILES[0].models[0], sizes: [['S', 1, 2]] }] };
    expect(() => buildCatalog([bad])).toThrow('Bad size row');
  });
  it('converts a size to a frame', () => {
    const f = toFrame(tarmac, tarmac.sizes.find((s) => s.size === '56')!);
    expect(f.id).toBe('cat:specialized-tarmac-sl8-2024-56');
    expect(f.name).toBe('Specialized Tarmac SL8 2024 · 56');
    expect(f.maxSpacers).toBe(30);
  });
});

describe('real catalog', () => {
  it('is big enough', () => {
    // 812 models from 49 brands when the pipeline last ran; fail on a big loss.
    expect(CATALOG.length).toBeGreaterThanOrEqual(770);
    expect(new Set(CATALOG.map((m) => m.brand)).size).toBeGreaterThanOrEqual(46);
  });
  it('has valid entries', () => {
    const cats = CATEGORIES.map((c) => c.value);
    const errs: string[] = [];
    for (const m of CATALOG) {
      const bad = (msg: string) => errs.push(`${m.id}: ${msg}`);
      if (!m.source.startsWith('https://')) bad('source');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(m.retrieved)) bad('retrieved');
      if (m.year < 2017 || m.year > 2027 || m.lastYear < m.year) bad('year');
      if (m.archive && !m.archive.startsWith('https://web.archive.org/web/')) bad('archive');
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
  it('dates well-known generations and lists each once', () => {
    const named = (brand: string, model: string) => CATALOG.filter((m) => m.brand === brand && m.model === model);
    const [sl7, ...moreSl7] = named('Specialized', 'Tarmac SL7');
    expect(moreSl7).toEqual([]);
    expect(sl7).toMatchObject({ year: 2021, lastYear: 2024 });
    // Specialized's frame stack and reach, not the 'stack to stem' it lists beside them.
    expect(sl7.sizes.find((s) => s.size === '56')).toMatchObject({ stack: 555, reach: 398 });
    expect(named('Specialized', 'Tarmac SL8')).toHaveLength(1);
    expect(named('Specialized', 'Tarmac SL8')[0].year).toBe(2024);
    expect(named('Specialized', 'Tarmac')).toEqual([]);
    expect(named('Trek', 'Domane Gen 4').map((m) => m.year)).toEqual([2023]);
    expect(named('Trek', 'Domane Gen 3')).toHaveLength(1);
    expect(named('Trek', 'Domane Gen 3')[0].lastYear).toBeLessThanOrEqual(2023);
    expect(named('Trek', 'Domane')).toEqual([]);
    expect(named('BMC', 'URS').length).toBeLessThanOrEqual(2);
  });
  it('has no stray rows or years the pages cannot support', () => {
    const labels = CATALOG.flatMap((m) => m.sizes.map((s) => `${m.id} ${s.size}`));
    expect(labels.filter((l) => / in$/.test(l))).toEqual([]);
    // A year past the newest capture (2026) only where the maker states the model year: 7 models, not the 52
    // that captures late in 2026 once pushed into 2027.
    expect(CATALOG.filter((m) => m.lastYear > 2026).length).toBeLessThanOrEqual(10);
    expect(CATALOG.filter((m) => m.year < 2018)).toEqual([]);
  });
  it('still contains the default frame', () => {
    const frames = CATALOG.flatMap((m) => m.sizes.map((s) => toFrame(m, s)));
    expect(frames.find((f) => f.id === DEFAULT_FRAME.id)).toEqual(DEFAULT_FRAME);
  });
});
