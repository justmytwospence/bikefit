import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import boardman from './boardman';
import type { Adapter } from '../types';

const BASE = 'https://www.boardmanbikes.com/gb_en/products';
const html = (file: string) => readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8');
const page = (file: string, url: string) => ({ url, timestamp: '20260101000000', related: {}, html: html(file) });

function check(
  a: Adapter, file: string, url: string, model: string, category: string, sizes: string[], one: [string, number, number],
  year?: number,
) {
  const found = a.extract(page(file, url));
  expect(found).toHaveLength(1);
  const [e] = found;
  expect(e.model).toBe(model);
  expect(e.category).toBe(category);
  expect(e.year).toBe(year);
  expect(e.sizes.map((s) => s.size)).toEqual(sizes);
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  return e;
}

describe('boardman', () => {
  it('reads the 2023 ADV 9.2 page, which states no year and has no wheelbase', () => {
    const e = check(boardman, 'boardman', `${BASE}/2394-adv-9.2.html`, 'ADV Carbon', 'gravel', ['SM', 'MD', 'LG', 'XL'], ['SM', 550, 368]);
    for (const s of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'chainstay', 'bbDrop'] as const) expect(s[k]).toBeGreaterThan(0);
    expect(e.sizes[0]).toEqual({
      size: 'SM', stack: 550, reach: 368, seatTubeLength: 500, headTubeLength: 120, headTubeAngle: 71, seatTubeAngle: 73, chainstay: 425, bbDrop: 73,
    });
    expect(e.sizes[1]).toMatchObject({ size: 'MD', stack: 570, reach: 381, headTubeAngle: 71.5 });
    expect(e.sizes.every((s) => s.wheelbase === undefined)).toBe(true);
  });
  it('reads the 2019 AIR 9.2 page: standard-range sizes, a dash column skipped, wheelbase, the year in the heading', () => {
    const e = check(boardman, 'boardman-2019', `${BASE}/2211-2018-air-9.2.html`, 'AIR', 'aero', ['XS', 'SM', 'MD', 'LG', 'XL'], ['XS', 511, 383], 2019);
    for (const s of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(s[k]).toBeGreaterThan(0);
    // The stack-to-reach ratio, the centimetre seat tube and the stem and crank rows are not read as geometry.
    expect(e.sizes[0]).toEqual({
      size: 'XS', stack: 511, reach: 383, seatTubeLength: 460, headTubeLength: 110, headTubeAngle: 72, seatTubeAngle: 74.5, chainstay: 405,
      bbDrop: 68, wheelbase: 971,
    });
    expect(e.sizes[4]).toMatchObject({ size: 'XL', stack: 586, reach: 405, wheelbase: 1008 });
  });
  it('reads the 2025 SLR 9.8 page, where all SLR numbers are one frame', () => {
    const e = check(boardman, 'boardman-2025', `${BASE}/2418-slr-9.8-carbon.html`, 'SLR', 'race', ['XS', 'SM', 'MD', 'LG', 'XL'], ['XS', 537, 371]);
    for (const s of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle'] as const) expect(s[k]).toBeGreaterThan(0);
    expect(e.sizes[0]).toMatchObject({ seatTubeLength: 465, headTubeAngle: 71, seatTubeAngle: 74, chainstay: 410, bbDrop: 74 });
    expect(e.sizes[2]).toMatchObject({ size: 'MD', stack: 563, reach: 388, headTubeAngle: 72.5, seatTubeAngle: 73.5 });
  });
  it('names the frame, not the build, and takes a stated year from the URL when the heading has none', () => {
    const p = page('boardman', `${BASE}/2332-adv-8.9-2021.html`);
    const swap = (h1: string, title: string) => ({ ...p, html: p.html.replace('<h1>ADV 9.2</h1>', `<h1>${h1}</h1>`).replace('Boardman ADV 9.2', title) });
    expect(boardman.extract(swap('ADV 8.9', 'ADV 8.9'))[0]).toMatchObject({ model: 'ADV Alloy', year: 2021 });
    expect(boardman.extract(swap('ADV 9.4', 'ADV 9.4'))[0].model).toBe('ADV Carbon');
    expect(boardman.extract(swap('ADV 8.9 Carbon', 'Boardman ADV 8.9 Carbon'))[0].model).toBe('ADV Carbon');
    expect(boardman.extract(swap('ADV 9.2', 'Boardman ADV 9.2 Alloy'))[0].model).toBe('ADV Alloy');
    expect(boardman.extract(swap('ADV 8.6 Women\'s', 'ADV 8.6 Women\'s'))[0].model).toBe('ADV Alloy Women\'s');
    expect(boardman.extract(swap('2019 CXR 9.4', 'Boardman CXR 9.4 - Men\'s Cyclocross Bike'))[0]).toMatchObject({ model: 'CXR', year: 2019, category: 'cyclocross' });
    expect(boardman.extract(swap('SLR 8.8 Disc 2021', 'SLR 8.8 2021'))[0]).toMatchObject({ model: 'SLR 8', year: 2021, category: 'race' });
    expect(boardman.extract(swap('SLR 9.4 Disc Carbon 2021', 'SLR 9.4 Disc Carbon 2021'))[0]).toMatchObject({ model: 'SLR 9 Disc', year: 2021 });
    expect(boardman.extract(swap('TRVL 9.2 DB', 'Boardman TRVL 9.2 DB'))[0]).toMatchObject({ model: 'TRVL', category: 'gravel' });
  });
  it('has nothing to read for flat-bar and electric bikes or a page without sizes', () => {
    const p = page('boardman', `${BASE}/2410-trvl-8.9-fb.html`);
    expect(boardman.extract({ ...p, html: p.html.replace('<h1>ADV 9.2</h1>', '<h1>TRVL 8.9 FB</h1>').replace('Boardman ADV 9.2', 'Boardman TRVL 8.9 Flat Bar') })).toEqual([]);
    expect(boardman.extract({ ...p, html: p.html.replace('<h1>ADV 9.2</h1>', '<h1>ADV 8.9e</h1>') })).toEqual([]);
    expect(boardman.extract({ ...p, html: '<html><head><title>SLR 9.8</title></head><body><h1>SLR 9.8</h1></body></html>' })).toEqual([]);
  });
  describe('accept', () => {
    it('takes drop-bar product pages and groups them by frame', () => {
      expect(boardman.accept('https://www.boardmanbikes.com/gb_en/products/2394-adv-9.2.html')).toEqual({ url: `${BASE}/2394-adv-9.2.html`, family: 'adv-carbon' });
      expect(boardman.accept('http://www.boardmanbikes.com/gb_en/products/2418-slr-9.8-carbon.html?utm_source=x#y')).toEqual({ url: `${BASE}/2418-slr-9.8-carbon.html`, family: 'slr' });
      expect(boardman.accept(`${BASE}/2216-2018-cxr-9.4.html`)).toEqual({ url: `${BASE}/2216-2018-cxr-9.4.html`, family: 'cxr-2018' });
      expect(boardman.accept(`${BASE}/2340-slr-8.8-2021.html`)?.family).toBe('slr-8-2021');
      expect(boardman.accept(`${BASE}/2256-slr-9.2.html`)?.family).toBe('slr-9-2019');
      expect(boardman.accept(`${BASE}/2411-trvl-8.9-db.html`)?.family).toBe('trvl');
      // Alloy and carbon ADVs, and men's and women's, are frames of their own.
      expect(boardman.accept(`${BASE}/2407-adv-9.2-alloy.html`)?.family).toBe('adv-alloy');
      expect(boardman.accept(`${BASE}/2402-adv-8.9.html`)?.family).toBe('adv-carbon');
      expect(boardman.accept(`${BASE}/2403-adv-8.9.html`)?.family).toBe('adv-alloy');
      expect(boardman.accept(`${BASE}/2333-adv-8.6w-2021.html`)?.family).toBe('adv-alloy-womens-2021');
    });
    it('rejects e-bikes, flat bars, juniors, parts, other bikes, other locales, press and listing pages', () => {
      expect(boardman.accept(`${BASE}/2327-adv-8.9e.html`)).toBeNull();
      expect(boardman.accept(`${BASE}/2410-trvl-8.9-fb.html`)).toBeNull();
      expect(boardman.accept(`${BASE}/2392-jnr-adv-26-junior.html`)).toBeNull();
      expect(boardman.accept(`${BASE}/107-boardman-elite-slr-five-wheelset.html`)).toBeNull();
      expect(boardman.accept(`${BASE}/605-y1415-air-tt-9.0.html`)).toBeNull();
      expect(boardman.accept(`${BASE}/427-cxr-9.4.html`)).toBeNull();
      expect(boardman.accept(`${BASE}/1177-road-comp.html`)).toBeNull();
      expect(boardman.accept('https://www.boardmanbikes.com/de_en/products/2394-adv-9.2.html')).toBeNull();
      expect(boardman.accept('https://www.boardmanbikes.com/gb_en/pr/2394-adv-9.2.html')).toBeNull();
      expect(boardman.accept('https://www.boardmanbikes.com/gb_en/categories/road/')).toBeNull();
      expect(boardman.accept('https://www.boardmanbikes.com/gb_en/bikes/road/adventure-gravel/')).toBeNull();
    });
  });
});
