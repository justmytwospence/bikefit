import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ridley from './ridley';
import type { Adapter } from '../types';
import type { FrameCategory } from '../../src/data/schema';

const B = 'https://www.ridley-bikes.com/en_US/bikes';
const page = (file: string, url: string) => ({
  url, timestamp: '20260101000000', related: {}, html: readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8'),
});

function check(
  a: Adapter, file: string, url: string, model: string, category: FrameCategory, year: number | undefined, sizes: string[],
  one: [string, number, number],
) {
  const found = a.extract(page(file, url));
  expect(found).toHaveLength(1);
  const [e] = found;
  expect(e.model).toBe(model);
  expect(e.category).toBe(category);
  expect(e.year).toBe(year);
  expect(e.sizes.map((s) => s.size).sort()).toEqual([...sizes].sort());
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
}

describe('ridley', () => {
  it('reads the 2021 page, whose heading is the frame and whose collection is 2020', () => {
    check(ridley, 'ridley', `${B}/SBINFDRID010`, 'Noah Fast Disc', 'aero', 2020, ['XS', 'S', 'M', 'L', 'XL'], ['M', 565, 393]);
    const [e] = ridley.extract(page('ridley', `${B}/SBINFDRID010`));
    // The letter rows: B seat tube, D head tube, E seat angle, F head angle, G chainstay, H BB drop, I wheelbase, S stack, R reach.
    expect(e.sizes[0]).toEqual({
      size: 'XS', seatTubeLength: 455, headTubeLength: 117, seatTubeAngle: 74, headTubeAngle: 72, chainstay: 405, bbDrop: 68,
      wheelbase: 975, stack: 516, reach: 378,
    });
  });
  it('reads the 2025 page, whose heading is a build, and names the frame from the SKU', () => {
    check(ridley, 'ridley-2025', `${B}/SBINF3RID004`, 'Noah Fast', 'aero', 2025, ['XXS', 'XS', 'S', 'M', 'L'], ['M', 541, 420]);
    const [e] = ridley.extract(page('ridley-2025', `${B}/SBINF3RID004`));
    expect(e.sizes[0]).toEqual({
      size: 'XXS', seatTubeLength: 480, headTubeLength: 95, seatTubeAngle: 76.5, headTubeAngle: 71.5, chainstay: 407, bbDrop: 72,
      wheelbase: 981, stack: 497, reach: 386,
    });
  });
  it('reads the 2026 template, which states no collection year', () => {
    check(ridley, 'ridley-2026', `${B}/SBIKF2RID015`, 'Kanzo Fast', 'gravel', undefined, ['XS', 'S', 'M', 'L'], ['M', 585, 408]);
  });
  it('names the frame by its SKU code and not by the heading', () => {
    const p = page('ridley-2025', `${B}/FFSKARRID040`);
    expect(ridley.extract(p)[0]).toMatchObject({ model: 'Grifn', category: 'endurance' });
    expect(ridley.extract({ ...p, url: `${B}/SBIXNIRID001` })[0]).toMatchObject({ model: 'X-Night', category: 'cyclocross' });
  });
  it('has nothing to read on a page without the table, a flat-bar build or a frame it does not list', () => {
    const p = page('ridley-2025', `${B}/SBINF3RID004`);
    expect(ridley.extract({ ...p, html: '<html><head><title>Noah FAST</title></head><body><h1>Noah FAST</h1></body></html>' })).toEqual([]);
    expect(ridley.extract({ ...p, html: p.html.replace(/<title>[^<]*<\/title>/, '<title>Kanzo Adventure Alu CUES EQ KAV01Am(M) | Ridley</title>'), url: `${B}/SBIKAVRID010` })).toEqual([]);
    expect(ridley.extract({ ...p, url: `${B}/SBIENORID011` })).toEqual([]);
    expect(ridley.extract({ ...p, url: 'https://www.ridley-bikes.com/product/noah-fast/' })).toEqual([]);
  });
  describe('accept', () => {
    it('takes complete bikes and framesets and groups them by frame', () => {
      expect(ridley.accept(`${B}/SBINF3RID004`)).toEqual({ url: `${B}/SBINF3RID004`, family: 'noah-fast' });
      expect(ridley.accept(`http://ridley-bikes.com:80/en_US/bikes/FFSKARRID040?tab=faq`)).toEqual({ url: `${B}/FFSKARRID040`, family: 'grifn' });
      expect(ridley.accept(`${B}/SBIHXDRID027/`)).toEqual({ url: `${B}/SBIHXDRID027`, family: 'helium-slx' });
      expect(ridley.accept(`${B}/SBIKF2RID015`)).toEqual({ url: `${B}/SBIKF2RID015`, family: 'kanzo-fast-2' });
      expect(ridley.accept(`${B}/SBIXNIRIDF28`)).toEqual({ url: `${B}/SBIXNIRIDF28`, family: 'x-night' });
    });
    it('rejects e-bikes, time trial, mountain, listings and the image-only site', () => {
      expect(ridley.accept(`${B}/SBIENORID011`)).toBeNull();
      expect(ridley.accept(`${B}/FFSDFDRID020`)).toBeNull();
      expect(ridley.accept(`${B}/SBIRAFRID001`)).toBeNull();
      expect(ridley.accept(`${B}/SBIYUNRID001`)).toBeNull();
      expect(ridley.accept(`${B}/platform/noah`)).toBeNull();
      expect(ridley.accept(`${B}/categories/road`)).toBeNull();
      expect(ridley.accept('https://www.ridley-bikes.com/product/noah-fast/')).toBeNull();
    });
  });
});
