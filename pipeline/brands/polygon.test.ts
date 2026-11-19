import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import polygon from './polygon';

const html = (file: string) => readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8');
const page = (file: string, url: string, edit = (h: string) => h) => ({
  url, timestamp: '20260101000000', related: {}, html: edit(html(file)),
});

describe('polygon', () => {
  // 2022 on: table.product-geometry__table, millimetre and inch spans in each cell. Tambora pages carry two tables
  // (gravel speed, then all road); the first is the one shown.
  it('reads the current product page', () => {
    const [e] = polygon.extract(page('polygon', 'https://www.polygonbikes.com/tambora-g7/'));
    expect([e.model, e.category, e.year]).toEqual(['Tambora G7', 'gravel', undefined]);
    expect(e.sizes.map((s) => s.size)).toEqual(['S', 'M', 'L', 'XL']);
    const s = e.sizes.find((x) => x.size === 'S')!;
    expect([s.stack, s.reach]).toEqual([568, 369]);
    expect([s.seatTubeAngle, s.headTubeAngle, s.wheelbase, s.chainstay, s.bbDrop]).toEqual([74.5, 70, 1017, 425, 78]);
    for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
  });

  // 2019-21 shop: a row of drawing letters over the labels, 'Drop' in the BB offset cells.
  it('reads the 2019-21 shop page', () => {
    const url = 'https://www.polygonbikes.com/eur/shop/bikes-eur/road-eur/performance-eur/strattos-s7-disc-brakes/';
    const [e] = polygon.extract(page('polygon-2020', url));
    expect([e.model, e.category, e.year]).toEqual(['Strattos S7', 'endurance', undefined]);
    expect(e.sizes.map((s) => s.size)).toEqual(['45', '48', '51', '54', '57', '60']);
    const s = e.sizes.find((x) => x.size === '51')!;
    expect([s.stack, s.reach, s.bbDrop]).toEqual([534, 387, 70]);
    for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
  });

  // 2018: the model year is in the path; the table lists no wheelbase and no rear centre, and the drop is 'BB Height (BB Drop/Rise)'.
  it('reads the 2018 page', () => {
    const [e] = polygon.extract(page('polygon-2018', 'http://www.polygonbikes.com:80/de/bikes/description/2018-strattos-7'));
    expect([e.model, e.category, e.year]).toEqual(['Strattos S7', 'endurance', 2018]);
    expect(e.sizes.map((s) => s.size)).toEqual(['47', '50', '53', '56', '59']);
    const s = e.sizes.find((x) => x.size === '53')!;
    expect([s.stack, s.reach, s.bbDrop]).toEqual([536, 388, 68]);
    for (const x of e.sizes) {
      for (const k of ['seatTubeAngle', 'headTubeAngle'] as const) expect(x[k]).toBeGreaterThan(0);
      expect(x.wheelbase).toBeUndefined();
    }
  });

  it('dates a page by its slug, then by its title, and not otherwise', () => {
    const titled = (h: string) => h.replace(/<title>[^<]*<\/title>/, '<title>2026 TAMBORA G7 Gravel Bike | Polygon Bikes</title>');
    expect(polygon.extract(page('polygon', 'https://www.polygonbikes.com/tambora-g7/', titled))[0].year).toBe(2026);
    // A copied page keeps its old title: bend-r2-2019 reads 2022.
    expect(polygon.extract(page('polygon', 'https://www.polygonbikes.com/strattos-s7d-2020/', titled))[0].year).toBe(2020);
  });

  it('is empty without a geometry table', () => {
    expect(polygon.extract(page('polygon', 'https://www.polygonbikes.com/tambora-g7/', (h) => h.replace(/<table[\s\S]*<\/table>/, '')))).toEqual([]);
    expect(polygon.extract(page('polygon', 'https://www.polygonbikes.com/strattos-s-alx/'))).toEqual([]);
  });

  it('accepts product pages and groups builds of one frame', () => {
    expect(polygon.accept('https://www.polygonbikes.com/bend-r9x/?attribute_pa_color=black&attribute_pa_size=m'))
      .toEqual({ url: 'https://www.polygonbikes.com/bend-r9x/', family: 'bend-r9x' });
    expect(polygon.accept('http://www.polygonbikes.com:80/us/helios-a9x-dura-ace-c60-2025/'))
      .toEqual({ url: 'https://www.polygonbikes.com/us/helios-a9x-dura-ace-c60-2025/', family: 'helios-a9x-2025' });
    expect(polygon.accept('https://www.polygonbikes.com/eur/shop/bikes-eur/road-eur/performance-eur/strattos-s7-disc-brakes/'))
      .toEqual({ url: 'https://www.polygonbikes.com/eur/shop/bikes-eur/road-eur/performance-eur/strattos-s7-disc-brakes/', family: 'strattos-s7' });
    expect(polygon.accept('http://www.polygonbikes.com:80/my/bikes/description/2018-helios-lt9-x-etap'))
      .toEqual({ url: 'https://www.polygonbikes.com/my/bikes/description/2018-helios-lt9-x-etap', family: 'helios-lt9x-2018' });
    expect(polygon.accept('https://www.polygonbikes.com/helios-a9x-entity-wr5/')?.family)
      .toBe(polygon.accept('https://www.polygonbikes.com/helios-a9x-dura-ace-c60/')?.family);
  });

  it('rejects other bikes, series, reviews and models before 2018', () => {
    expect(polygon.accept('https://www.polygonbikes.com/us/strattos-us/')).toBeNull();
    expect(polygon.accept('https://www.polygonbikes.com/bend-fx4-2018/')).toBeNull();
    expect(polygon.accept('https://www.polygonbikes.com/tambora-ae-gx/')).toBeNull();
    expect(polygon.accept('https://www.polygonbikes.com/helios-f5/')).toBeNull();
    expect(polygon.accept('https://www.polygonbikes.com/helios-a-road-bike-tested-by-escape-collective-and-velo/')).toBeNull();
    expect(polygon.accept('https://www.polygonbikes.com/strattos-vs-helios-road-bike-comparison/')).toBeNull();
    expect(polygon.accept('https://www.polygonbikes.com/eur/shop/bikes-eur/road-eur/performance-eur/helios-a8-2016/')).toBeNull();
    expect(polygon.accept('http://www.polygonbikes.com:80/id/bikes/description/2017-bend-riv1')).toBeNull();
    expect(polygon.accept('http://www.polygonbikes.com:80/my/bikes/description/2018-xtrada-5-blue')).toBeNull();
  });
});
