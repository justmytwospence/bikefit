import { describe, expect, it } from 'vitest';
import type { SizeRow } from '../../src/data/schema';
import type { Adapter, Extracted, Manifest, Overrides, Page } from '../types';
import { buildBrand, fitEstimates, formatBrand, midFill, pageKey } from './build';

const sz = (size: string, stack: number, reach: number, extra: Record<string, number> = {}) => ({
  size, stack, reach, seatTubeAngle: 73.5, headTubeAngle: 72.5, headTubeLength: 120, seatTubeLength: 500,
  chainstay: 410, wheelbase: 980, bbDrop: 72, ...extra,
});
const sizes = (off = 0) => [sz('S', 520 + off, 370), sz('M', 540 + off, 380), sz('L', 560 + off, 390)];

function setup(pagesData: { year: number; ts: string; url: string; out: Extracted[] }[]) {
  const manifest: Manifest = {
    brand: 'Test', file: 'test',
    pages: pagesData.map((p) => ({ url: p.url, timestamp: p.ts, sha256: 'x', family: 'f', year: p.year, related: [] })),
  };
  const pages = new Map<string, Page>(pagesData.map((p) => [pageKey(p.url, p.ts), { url: p.url, timestamp: p.ts, html: p.url, related: {} }]));
  const adapter: Adapter = {
    brand: 'Test', file: 'test', prefixes: [], seeds: [], accept: () => null,
    extract: (page) => pagesData.find((p) => p.url === page.url)!.out,
  };
  return { manifest, pages, adapter };
}
const none: Overrides = { manual: [], exclude: [], models: {} };
const ex = (model: string, s = sizes()): Extracted => ({ model, category: 'race', sizes: s });

describe('buildBrand', () => {
  it('merges identical geometry across years', () => {
    const { manifest, pages, adapter } = setup([
      { year: 2020, ts: '20200301000000', url: 'https://a/1', out: [ex('Bike')] },
      { year: 2024, ts: '20240301000000', url: 'https://a/2', out: [ex('Bike')] },
    ]);
    const f = buildBrand(adapter, manifest, pages, none, midFill);
    expect(f.models).toHaveLength(1);
    expect(f.models[0]).toMatchObject({ year: 2020, lastYear: 2024, source: 'https://a/2', retrieved: '2024-03-01' });
    expect(f.models[0].archive).toBe('https://web.archive.org/web/20240301000000/https://a/2');
  });
  it('keeps different geometry as separate years', () => {
    const { manifest, pages, adapter } = setup([
      { year: 2020, ts: '20200301000000', url: 'https://a/1', out: [ex('Bike')] },
      { year: 2024, ts: '20240301000000', url: 'https://a/2', out: [ex('Bike', sizes(10))] },
    ]);
    expect(buildBrand(adapter, manifest, pages, none, midFill).models.map((m) => m.year)).toEqual([2020, 2024]);
  });
  it('drops a size missing reach and estimates a missing bb drop', () => {
    const bad = { ...sz('XL', 580, 0), reach: undefined } as unknown as ReturnType<typeof sz>;
    const noDrop = sizes().map((s) => ({ ...s, bbDrop: undefined })) as unknown as ReturnType<typeof sz>[];
    const { manifest, pages, adapter } = setup([
      { year: 2024, ts: '20240301000000', url: 'https://a/1', out: [ex('A', [...sizes(), bad]), ex('B', noDrop)] },
    ]);
    const f = buildBrand(adapter, manifest, pages, none, midFill);
    expect(f.models.find((m) => m.model === 'A')!.sizes).toHaveLength(3);
    const b = f.models.find((m) => m.model === 'B')!;
    expect(b.estimated).toEqual(['bbDrop']);
  });
  it('emits a manual entry only when its source was not extracted', () => {
    const row: SizeRow = ['S', 520, 370, 73.5, 72.5, 120, 500, 410, 980, 72];
    const man = (source: string, model: string) => ({
      model, year: 2024, category: 'race' as const, source, retrieved: '2026-01-01', sizes: [row, ['M', 540, 380, 73.5, 72.5, 120, 500, 410, 980, 72] as SizeRow],
    });
    const { manifest, pages, adapter } = setup([{ year: 2024, ts: '20240301000000', url: 'https://a/1', out: [ex('Bike')] }]);
    const f = buildBrand(adapter, manifest, pages, { ...none, manual: [man('https://a/1/', 'Hand'), man('https://a/9', 'Other')] }, midFill);
    expect(f.models.map((m) => m.model)).toEqual(['Bike', 'Other']);
  });
  it('drops a manual entry whose model and years are already covered', () => {
    const man = (model: string, year: number) => ({
      model, year, category: 'race' as const, source: `https://other/${model}${year}`, retrieved: '2026-01-01',
      sizes: [['S', 520, 370, 73.5, 72.5, 120, 500, 410, 980, 72], ['M', 540, 380, 73.5, 72.5, 120, 500, 410, 980, 72]] as SizeRow[],
    });
    const { manifest, pages, adapter } = setup([
      { year: 2020, ts: '20200301000000', url: 'https://a/1', out: [ex('Bike')] },
      { year: 2024, ts: '20240301000000', url: 'https://a/2', out: [ex('Bike')] },
    ]);
    const f = buildBrand(adapter, manifest, pages, { ...none, manual: [man('Bike', 2022), man('Bike', 2018)] }, midFill);
    expect(f.models.map((m) => `${m.model} ${m.year}`)).toEqual(['Bike 2018', 'Bike 2020']);
  });
  it('keeps a real size whose reach dips by a millimetre', () => {
    const s = [sz('S', 520, 370), sz('M', 540, 369), sz('L', 560, 395)];
    const { manifest, pages, adapter } = setup([{ year: 2024, ts: '20240301000000', url: 'https://a/1', out: [ex('A', s)] }]);
    expect(buildBrand(adapter, manifest, pages, none, midFill).models[0].sizes).toHaveLength(3);
  });
  it('merges a prefix-related name with the same geometry, latest name leading', () => {
    const { manifest, pages, adapter } = setup([
      { year: 2022, ts: '20220301000000', url: 'https://a/1', out: [ex('Domane')] },
      { year: 2024, ts: '20240301000000', url: 'https://a/2', out: [ex('Domane Gen 4')] },
    ]);
    const f = buildBrand(adapter, manifest, pages, none, midFill);
    expect(f.models).toHaveLength(1);
    expect(f.models[0]).toMatchObject({ model: 'Domane Gen 4', year: 2022, lastYear: 2024, aliases: ['Domane'] });
  });
  it('keeps unrelated names apart even with the same geometry', () => {
    const { manifest, pages, adapter } = setup([
      { year: 2022, ts: '20220301000000', url: 'https://a/1', out: [ex('Madone'), ex('Émonda')] },
    ]);
    expect(buildBrand(adapter, manifest, pages, none, midFill).models.map((m) => m.model)).toEqual(['Émonda', 'Madone']);
  });
  it('does not chain generations through a shared prefix', () => {
    const { manifest, pages, adapter } = setup([
      { year: 2021, ts: '20210301000000', url: 'https://a/1', out: [ex('Madone')] },
      { year: 2023, ts: '20230301000000', url: 'https://a/2', out: [ex('Madone Gen 6')] },
      { year: 2024, ts: '20240301000000', url: 'https://a/3', out: [ex('Madone Gen 7')] },
    ]);
    const f = buildBrand(adapter, manifest, pages, none, midFill);
    expect(f.models.map((m) => m.model)).toEqual(['Madone Gen 6', 'Madone Gen 7']);
    expect(f.models.find((m) => m.model === 'Madone Gen 7')!.aliases).toEqual(['Madone']);
  });
  it('keeps two entries when a stack differs by 3 mm', () => {
    const { manifest, pages, adapter } = setup([
      { year: 2022, ts: '20220301000000', url: 'https://a/1', out: [ex('Bike')] },
      { year: 2024, ts: '20240301000000', url: 'https://a/2', out: [ex('Bike', [sz('S', 523, 370), sz('M', 540, 380), sz('L', 560, 390)])] },
    ]);
    expect(buildBrand(adapter, manifest, pages, none, midFill).models).toHaveLength(2);
  });
  it('folds a manual entry with the same geometry into the page-derived years', () => {
    const rows = sizes().map((s) => [s.size, s.stack, s.reach, 73.5, 72.5, 120, 500, 410, 980, 72] as SizeRow);
    const manual = { model: 'Bike', year: 2018, category: 'race' as const, source: 'https://other/x', retrieved: '2026-01-01', sizes: rows };
    const { manifest, pages, adapter } = setup([
      { year: 2020, ts: '20200301000000', url: 'https://a/1', out: [ex('Bike')] },
      { year: 2024, ts: '20240301000000', url: 'https://a/2', out: [ex('Bike')] },
    ]);
    const f = buildBrand(adapter, manifest, pages, { ...none, manual: [manual] }, midFill);
    expect(f.models).toHaveLength(1);
    expect(f.models[0]).toMatchObject({ year: 2018, lastYear: 2024 });
  });
  it('dates a URL by its first capture', () => {
    const data = (out2: Extracted[]) => setup([
      { year: 2025, ts: '20250301000000', url: 'https://a/1', out: [ex('Bike')] },
      { year: 2026, ts: '20260301000000', url: 'https://a/1', out: out2 },
    ]);
    for (const [out2, years] of [[[ex('Bike', sizes(10))], [2020, 2026]], [[ex('Bike')], [2020, 2026]]] as [Extracted[], number[]][]) {
      const d = data(out2);
      d.manifest.pages.forEach((p) => { p.firstSeen = '20190801000000'; });
      const f = buildBrand(d.adapter, d.manifest, d.pages, none, midFill);
      expect(f.models[0].year).toBe(years[0]);
      expect(f.models[f.models.length - 1].lastYear ?? f.models[f.models.length - 1].year).toBe(years[1]);
    }
  });
  it('is byte-identical across runs and page order', () => {
    const data = [
      { year: 2020, ts: '20200301000000', url: 'https://a/1', out: [ex('Bike'), ex('Other', sizes(10))] },
      { year: 2024, ts: '20240301000000', url: 'https://a/2', out: [ex('Bike'), ex('Third', sizes(20))] },
    ];
    const a = setup(data);
    const b = setup([...data].reverse());
    const fa = fitEstimates([buildBrand(a.adapter, a.manifest, a.pages, none, midFill)]);
    const ta = formatBrand(buildBrand(a.adapter, a.manifest, a.pages, none, fa));
    expect(formatBrand(buildBrand(a.adapter, a.manifest, a.pages, none, fa))).toBe(ta);
    expect(formatBrand(buildBrand(b.adapter, b.manifest, b.pages, none, fa))).toBe(ta);
  });
});
