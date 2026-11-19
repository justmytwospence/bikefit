import { describe, expect, it } from 'vitest';
import type { SizeRow } from '../../src/data/schema';
import type { Adapter, Extracted, Manifest, Overrides, Page } from '../types';
import { buildBrand, fitEstimates, formatBrand, midFill, pageKey } from './build';

const sz = (size: string, stack: number, reach: number, extra: Record<string, number> = {}) => ({
  size, stack, reach, seatTubeAngle: 73.5, headTubeAngle: 72.5, headTubeLength: 120, seatTubeLength: 500,
  chainstay: 410, wheelbase: 980, bbDrop: 72, ...extra,
});
const sizes = (off = 0) => [sz('S', 520 + off, 370), sz('M', 540 + off, 380), sz('L', 560 + off, 390)];

function setup(pagesData: { year: number; ts: string; url: string; out: Extracted[]; firstSeen?: string }[]) {
  const manifest: Manifest = {
    brand: 'Test', file: 'test',
    pages: pagesData.map((p) => ({ url: p.url, timestamp: p.ts, sha256: 'x', family: 'f', year: p.year, related: [], firstSeen: p.firstSeen })),
  };
  const pages = new Map<string, Page>(pagesData.map((p) => [pageKey(p.url, p.ts), { url: p.url, timestamp: p.ts, html: p.url, related: {} }]));
  const adapter: Adapter = {
    brand: 'Test', file: 'test', prefixes: [], seeds: [], accept: () => null,
    extract: (page) => pagesData.find((p) => p.url === page.url)!.out,
  };
  return { manifest, pages, adapter };
}
const none: Overrides = { manual: [], exclude: [], models: {} };
const ex = (model: string, s = sizes(), year?: number): Extracted => ({ model, year, category: 'race', sizes: s });
/** One page per call: a capture on 1 March of `year` at its own URL. */
let serial = 0;
const at = (year: number, ...out: Extracted[]) => ({ year, ts: `${year}0301000000`, url: `https://a/${++serial}`, out });
const build = (...data: ReturnType<typeof at>[]) => {
  const { manifest, pages, adapter } = setup(data);
  return buildBrand(adapter, manifest, pages, none, midFill).models;
};
const four = (off = 0) => [...sizes(off), sz('XL', 580 + off, 400)];

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
      sizes: [['S', 530, 370, 73.5, 72.5, 120, 500, 410, 980, 72], ['M', 550, 380, 73.5, 72.5, 120, 500, 410, 980, 72]] as SizeRow[],
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
  it('merges a name into the generation it was on sale with', () => {
    const m = build(at(2021, ex('Domane')), at(2022, ex('Domane')), at(2022, ex('Domane Gen 4')), at(2024, ex('Domane Gen 4')));
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ model: 'Domane Gen 4', year: 2021, lastYear: 2024, aliases: ['Domane'] });
  });
  it('leaves an older bike out of a generation it never overlapped', () => {
    const m = build(at(2020, ex('Roubaix')), at(2022, ex('Roubaix')), at(2023, ex('Roubaix SL8')), at(2026, ex('Roubaix SL8')));
    expect(m.map((x) => `${x.model} ${x.year}-${x.lastYear}`)).toEqual(['Roubaix 2020-2022', 'Roubaix SL8 2023-2026']);
  });
  it('counts a year apart as on sale together once a later generation exists', () => {
    const m = build(
      at(2022, ex('Checkpoint SL')), at(2023, ex('Checkpoint SL')), at(2024, ex('Checkpoint SL Gen 2')),
      at(2024, ex('Checkpoint SL Gen 3', sizes(30))),
    );
    expect(m.map((x) => x.model)).toEqual(['Checkpoint SL Gen 2', 'Checkpoint SL Gen 3']);
    expect(m[0]).toMatchObject({ year: 2022, lastYear: 2024, aliases: ['Checkpoint SL'] });
  });
  it('leads with the shorter name when neither states a generation', () => {
    for (const [early, late] of [['Krypton Pro', 'Krypton'], ['Krypton', 'Krypton Pro']]) {
      const m = build(at(2021, ex(early)), at(2024, ex(late)));
      expect(m).toHaveLength(1);
      expect(m[0]).toMatchObject({ model: 'Krypton', year: 2021, lastYear: 2024, aliases: ['Krypton Pro'] });
    }
  });
  it('keeps unrelated names apart even with the same geometry', () => {
    const { manifest, pages, adapter } = setup([
      { year: 2022, ts: '20220301000000', url: 'https://a/1', out: [ex('Madone'), ex('Émonda')] },
    ]);
    expect(buildBrand(adapter, manifest, pages, none, midFill).models.map((m) => m.model)).toEqual(['Émonda', 'Madone']);
  });
  it('gives a name to the older of two generations and never chains them', () => {
    const m = build(
      at(2021, ex('Madone')), at(2023, ex('Madone')), at(2023, ex('Madone Gen 6')), at(2023, ex('Madone Gen 7')), at(2024, ex('Madone Gen 7')),
    );
    expect(m.map((x) => x.model)).toEqual(['Madone Gen 6', 'Madone Gen 7']);
    expect(m[0]).toMatchObject({ year: 2021, lastYear: 2023, aliases: ['Madone'] });
    expect(m[1]).toMatchObject({ year: 2023, lastYear: 2024 });
    expect(m[1].aliases).toBeUndefined();
  });
  it('merges a page that lists fewer sizes and keeps every size', () => {
    const m = build(at(2020, ex('Bike', four().slice(0, 3))), at(2024, ex('Bike', four())), at(2025, ex('Bike', four().slice(1))));
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ year: 2020, lastYear: 2025 });
    expect(m[0].sizes.map((r) => r[0])).toEqual(['S', 'M', 'L', 'XL']);
  });
  it('keeps apart size runs that only overlap', () => {
    const other = [sz('M', 540, 380), sz('L', 560, 390), sz('XXL', 600, 410)];
    expect(build(at(2020, ex('Bike')), at(2024, ex('Bike', other)))).toHaveLength(2);
  });
  it('ignores a value one page had to estimate', () => {
    const noDrop = sizes().map((s) => ({ ...s, bbDrop: undefined })) as unknown as ReturnType<typeof sz>[];
    const m = build(at(2020, ex('Bike', sizes().map((s) => ({ ...s, bbDrop: 60 })))), at(2024, ex('Bike', noDrop)));
    expect(m).toHaveLength(1);
    expect(m[0].estimated).toBeUndefined();
    expect(m[0].sizes[0][9]).toBe(60);
    expect(m[0]).toMatchObject({ year: 2020, lastYear: 2024, source: 'https://a/' + (serial - 1) });
  });
  it('takes one differing size of four as a corrected typo, two as another frame', () => {
    const fixed = four().map((s) => (s.size === 'M' ? { ...s, wheelbase: 990, reach: 384 } : s));
    const m = build(at(2020, ex('Bike', four())), at(2024, ex('Bike', fixed)));
    expect(m).toHaveLength(1);
    expect(m[0].sizes[1]).toEqual(['M', 540, 384, 73.5, 72.5, 120, 500, 410, 990, 72]);
    const two = fixed.map((s) => (s.size === 'L' ? { ...s, wheelbase: 1000 } : s));
    expect(build(at(2020, ex('Bike', four())), at(2024, ex('Bike', two)))).toHaveLength(2);
  });
  it('uses the model year a page states and drops pages from before 2018', () => {
    const m = build(at(2025, ex('Old', sizes(), 2016)), at(2025, ex('Bike', sizes(10), 2019)), at(2026, ex('Bike', sizes(10), 2021)));
    expect(m.map((x) => `${x.model} ${x.year}-${x.lastYear}`)).toEqual(['Bike 2019-2021']);
  });
  it('dates a capture by its calendar year, and a first capture as a model year no later than the page', () => {
    const one = (ts: string, firstSeen?: string) => {
      const { manifest, pages, adapter } = setup([{ year: 0, ts, url: 'https://a/1', out: [ex('Bike')], firstSeen }]);
      return buildBrand(adapter, manifest, pages, none, midFill).models[0].year;
    };
    expect(one('20261105000000')).toBe(2026);
    expect(one('20261105000000', '20260901000000')).toBe(2026);
    expect(one('20240301000000', '20220901000000')).toBe(2023);
    expect(one('20240301000000', '20220301000000')).toBe(2022);
    expect(one('20240301000000', '20160301000000')).toBe(2018);
  });
  it('drops only the stray row when reach falls out of order', () => {
    const s = [sz('S', 520, 370), sz('M', 540, 380), sz('23 in', 550, 470), sz('L', 560, 390), sz('XL', 580, 400)];
    expect(build(at(2024, ex('Bike', s)))[0].sizes.map((r) => r[0])).toEqual(['S', 'M', 'L', 'XL']);
  });
  it('pins years from the overrides to the frame with that size', () => {
    const { manifest, pages, adapter } = setup([at(2022, ex('Bike')), at(2024, ex('Bike')), at(2023, ex('Bike', sizes(20)))]);
    const years = [{ model: 'Bike', size: 'M', stack: 540, reach: 380, year: 2021, note: 'launch report' }];
    const f = buildBrand(adapter, manifest, pages, { ...none, years }, midFill);
    expect(f.models.map((x) => `${x.year}-${x.lastYear}`)).toEqual(['2021-2024', '2023-undefined']);
  });
  it('keeps the frame more pages show when two share a name and first year', () => {
    const { manifest, pages, adapter } = setup([at(2020, ex('Bike', sizes(10))), at(2020, ex('Bike')), at(2022, ex('Bike'))]);
    const log: string[] = [];
    const f = buildBrand(adapter, manifest, pages, none, midFill, (s) => log.push(s));
    expect(f.models).toHaveLength(1);
    expect(f.models[0].sizes[0][1]).toBe(520);
    expect(log.some((l) => l.startsWith('duplicate: Test Bike 2020'))).toBe(true);
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
