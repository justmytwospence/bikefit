import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import salsa from './salsa';
import type { Adapter } from '../types';

const page = (file: string, url: string) => ({
  url, timestamp: '20260101000000', related: {}, html: readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8'),
});

function check(
  a: Adapter, file: string, url: string, model: string, year: number | undefined, sizes: string[], one: [string, number, number],
) {
  const found = a.extract(page(file, url));
  expect(found).toHaveLength(1);
  const [e] = found;
  expect(e.model).toBe(model);
  expect(e.category).toBe('gravel');
  expect(e.year).toBe(year);
  expect(e.sizes.map((s) => s.size)).toEqual(sizes);
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
}

const SIZES = ['49cm', '52.5cm', '54.5cm', '56cm', '57.5cm', '59cm', '61cm'];

describe('salsa', () => {
  it('reads the shop page of a 2024 Warbird (geoTable, lettered rows)', () => {
    check(salsa, 'salsa', 'https://www.salsacycles.com/products/2024-warbird-c-grx-820', 'Warbird', 2024, SIZES, ['56cm', 585, 381]);
    const [e] = salsa.extract(page('salsa', 'https://www.salsacycles.com/products/2024-warbird-c-grx-820'));
    // 'G. Headtube Angle' is the angle, not a length, and 'E. Total Seat Tube Length' is read.
    expect(e.sizes[0]).toEqual({
      size: '49cm', reach: 360, stack: 518, seatTubeLength: 390, headTubeLength: 90, headTubeAngle: 71, seatTubeAngle: 75,
      bbDrop: 70, chainstay: 430, wheelbase: 996,
    });
    expect(e.sizes[6]).toMatchObject({ size: '61cm', stack: 642, reach: 408, headTubeAngle: 70.8, seatTubeAngle: 72.5, wheelbase: 1085 });
  });
  it('reads a 2019 bike page of the old site, the metric block only', () => {
    const [e] = salsa.extract(page('salsa-2019', 'https://www.salsacycles.com/bikes/warbird/2019_warbird_carbon_105_700'));
    check(salsa, 'salsa-2019', 'https://www.salsacycles.com/bikes/warbird/2019_warbird_carbon_105_700', 'Warbird', 2019, SIZES, ['56cm', 585, 381]);
    // 'C. Headtube Angle' comes before 'G. Headtube Length' on these pages.
    expect(e.sizes[3]).toMatchObject({ size: '56cm', headTubeAngle: 70.8, headTubeLength: 160, seatTubeAngle: 73, seatTubeLength: 510 });
  });
  it('reads an archived bike on the shop, whose table has Metric rows', () => {
    check(salsa, 'salsa-archive', 'https://www.salsacycles.com/products/2019_warbird_carbon_force_1_650', 'Warbird', 2019, SIZES, ['56cm', 585, 381]);
  });
  it('takes the model year from the title, else the URL, else none', () => {
    const p = page('salsa', 'https://www.salsacycles.com/products/flyway-c-dlx-force-xplr');
    const [e] = salsa.extract({ ...p, html: p.html.replace('<h1>Warbird C GRX 820</h1>', '<h1>Flyway C DLX Force XPLR</h1>') });
    expect(e.model).toBe('Flyway');
    expect(e.year).toBeUndefined();
    const q = page('salsa-2019', 'https://www.salsacycles.com/bikes/fargo/2019_fargo_ti_frameset');
    const html = q.html.replace('<title>2019 Warbird Carbon 105 700 | Salsa Cycles</title>', '<title>FARGO TI FRAMESET | Salsa Cycles</title>')
      .replace('<h1 class="bike-title">Warbird Carbon 105 700</h1>', '<h1 class="tk-proxima-nova">FARGO</h1>');
    const [f] = salsa.extract({ ...q, html });
    expect([f.model, f.year]).toEqual(['Fargo', 2019]);
  });
  it('names the frame, not the build, and files the categories', () => {
    const p = page('salsa', 'https://www.salsacycles.com/products/2022-warroad-c-ultegra');
    const named = (h1: string, url: string) => salsa.extract({ ...p, url, html: p.html.replace('<h1>Warbird C GRX 820</h1>', `<h1>${h1}</h1>`) })[0];
    expect(named('2022 Warroad C Ultegra', p.url)).toMatchObject({ model: 'Warroad', year: 2022, category: 'endurance' });
    expect(named('2023 Stormchaser Single Speed', p.url).category).toBe('cyclocross');
    expect(named('Fargo 32 Steel Frameset', 'https://www.salsacycles.com/products/fargo-32-steel-frameset').model).toBe('Fargo 32');
    expect(named('2022 Journeyer Flat Bar Deore 700c', p.url)).toBeUndefined();
    expect(named('Timberjack SLX 29', p.url)).toBeUndefined();
  });
  it('has nothing to read on a page without the table', () => {
    const shell = '<html><head><title>Warbird | Salsa Cycles</title></head><body><div id="root"></div></body></html>';
    expect(salsa.extract({ url: 'https://www.salsacycles.com/bikes/2021_warbird_carbon_grx_600', timestamp: '20220103231246', related: {}, html: shell })).toEqual([]);
  });
  describe('accept', () => {
    it('takes bike pages of the old site and shop pages, and groups them by frame', () => {
      expect(salsa.accept('https://www.salsacycles.com/bikes/warbird/2019_warbird_carbon_105_700')).toEqual({
        url: 'https://www.salsacycles.com/bikes/warbird/2019_warbird_carbon_105_700', family: 'warbird',
      });
      expect(salsa.accept('http://www.salsacycles.com:80/bikes/journeyman_650b/2019_journeyman_claris_650?pr_prod_strat=jsonld')).toEqual({
        url: 'https://www.salsacycles.com/bikes/journeyman_650b/2019_journeyman_claris_650', family: 'journeyman',
      });
      expect(salsa.accept('https://www.salsacycles.com/products/2024-warbird-c-grx-820?variant=4123&pr_rd_page=2')).toEqual({
        url: 'https://www.salsacycles.com/products/2024-warbird-c-grx-820', family: 'warbird',
      });
      expect(salsa.accept('https://salsacycles.com/products/flyway-c-dlx-force-xplr')).toEqual({
        url: 'https://www.salsacycles.com/products/flyway-c-dlx-force-xplr', family: 'flyway',
      });
      expect(salsa.accept('https://www.salsacycles.com/products/fargo-32-steel-frameset')).toEqual({
        url: 'https://www.salsacycles.com/products/fargo-32-steel-frameset', family: 'fargo-32',
      });
      expect(salsa.accept('https://www.salsacycles.com/products/2026-fargo-ti-frameset')?.family).toBe('fargo');
      expect(salsa.accept('https://www.salsacycles.com/products/cutthroat-c-grx-610-1x')?.family).toBe('cutthroat');
    });
    it('rejects flat bars, kids, e-bikes, mountain bikes, gear, listings and models before 2018', () => {
      expect(salsa.accept('https://www.salsacycles.com/products/2022-journeyer-flat-bar-altus-700c')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/bikes/journeyman/2019_journeyman_flat_bar_claris_700')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/bikes/journeyman_24/2021_journeyman_24')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/products/2021_journeyman_24_red')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/products/confluence-grx-600-2x')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/products/2025-tributary-c-grx-820-us')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/products/2023-timberjack-slx-29')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/products/2022-rangefinder-advent-x-29')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/products/cowbell_deluxe')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/products/2017_cutthroat_rival')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/bikes/warbird/2016_warbird_105_11')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/bikes/warbird/')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/bikes/warbird/2019_warbird_carbon_105_700/geometry/')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/bikes/fargo/gtm.js')).toBeNull();
      // Handles without a year that are not the 2026 frames: nothing says which year they belong to.
      expect(salsa.accept('https://www.salsacycles.com/products/journeyman_claris_700')).toBeNull();
      expect(salsa.accept('https://www.salsacycles.com/products/fargo_2009')).toBeNull();
    });
  });
});
