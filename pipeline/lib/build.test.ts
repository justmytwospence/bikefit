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
