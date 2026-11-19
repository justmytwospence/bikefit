import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import litespeed from './litespeed';
import type { Adapter } from '../types';

const read = (file: string) => readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8');
const page = (file: string, url: string) => ({ url, timestamp: '20260101000000', related: {}, html: read(file) });

function check(a: Adapter, p: ReturnType<typeof page>, model: string, category: string, sizes: string[], one: [string, number, number]) {
  const found = a.extract(p);
  expect(found).toHaveLength(1);
  const [e] = found;
  expect(e.model).toBe(model);
  expect(e.category).toBe(category);
  expect(e.year).toBeUndefined();
  expect(e.sizes.map((s) => s.size)).toEqual(sizes);
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
  return e;
}

describe('litespeed', () => {
  it('reads the 2025 page, plain labels across the top', () => {
    const e = check(litespeed, page('litespeed', 'https://litespeed.com/products/arenberg-fi'), 'Arenberg', 'endurance',
      ['XS', 'S', 'M', 'M/L', 'L', 'XL'], ['M', 565, 375]);
    // Centimetres in the cells; the FI twin carries the frame's name.
    expect(e.sizes[2]).toEqual({
      size: 'M', stack: 565, reach: 375, headTubeLength: 148, seatTubeAngle: 73.5, headTubeAngle: 72, bbDrop: 76, chainstay: 420,
      wheelbase: 994, seatTubeLength: 480,
    });
  });
  it('reads the 2019 page, whose rows lead with the drawing letter', () => {
    const e = check(litespeed, page('litespeed-2019', 'https://litespeed.com/products/cherohala-frame'), 'Cherohala', 'endurance',
      ['S', 'M', 'M/L', 'L', 'XL'], ['M', 575, 375]);
    expect(e.sizes[1]).toMatchObject({ chainstay: 430, bbDrop: 71, wheelbase: 1024, headTubeAngle: 71, seatTubeAngle: 74.5, headTubeLength: 132 });
  });
  it('reads the metric table of a 2024 page and not the inch copy', () => {
    const e = check(litespeed, page('litespeed-2024', 'https://litespeed.com/products/ultimate-g2'), 'Ultimate G2', 'gravel',
      ['XS', 'S', 'M', 'ML', 'L', 'XL'], ['M', 560, 390]);
    expect(e.sizes[2]).toMatchObject({ chainstay: 425, bbDrop: 74, wheelbase: 1024, headTubeAngle: 71.5, seatTubeAngle: 73.5, seatTubeLength: 470 });
    // Only the metric table has lengths in range.
    expect(e.sizes.every((s) => s.stack! > 500 && s.chainstay === 425)).toBe(true);
  });
  it('names the frame from the h1 of the Shopify template or the title of the old site', () => {
    const p = page('litespeed-2019', 'https://litespeed.com/products/cherohala-frame');
    // Without a heading the title gives the frame: 'Litespeed Cherohala Titanium All-Road Frame or Frameset'. Other bikes are not read.
    expect(litespeed.extract({ ...p, html: p.html.replace('<h1 class="product_name" itemprop="name">Cherohala Frame</h1>', '<h1></h1>') })[0].model).toBe('Cherohala');
    expect(litespeed.extract({ ...p, html: p.html.replace(/<h1[\s\S]*?<\/h1>/, '<h1>Cherohala City Frame</h1>').replace(/<title>[\s\S]*?<\/title>/, '<title>Litespeed Cherohala City | Urban</title>') })).toEqual([]);
  });
  it('states the model year of an old-site page, as its breadcrumb and path do', () => {
    // The 2018 Gravel page (archived 2018-01-30): a title, the breadcrumb and one table of centimetres, sizes across.
    const rows: [string, ...string[]][] = [
      ['Top Tube Length', '52.5', '53.5', '55.5', '57', '59'], ['Head Tube Angle', '71', '71.5', '72.0', '72.5', '72.5'],
      ['Seat Tube Angle', '74.5', '74.5', '74.0', '73.5', '73'], ['Seat Tube Length', '47.5', '49.5', '51.5', '53.5', '55.5'],
      ['Chainstay Length', '43', '43', '43', '43', '43'], ['BB Drop (CM)', '7.1', '7.1', '7.1', '7.1', '7.4'],
      ['Wheelbase (CM)', '101.2', '101.9', '103', '103.7', '104.7'], ['Head Tube Length (CM)', '11.1', '12.5', '14.4', '16.8', '19.6'],
      ['Stack', '55', '56.5', '58.5', '61', '64'], ['Reach', '37', '37.7', '38.6', '39', '39.3'],
    ];
    const tr = (r: string[]) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}<td></td></tr>`;
    const html = '<html><head><title>Gravel | All Road | Titanium | Litespeed Bicycles | Litespeed Bicycles</title></head><body>'
      + '<h1 class="alt">Features</h1><a href="http://litespeed.com/our-bikes/titanium/adventure/2018-gravel" title="2018">2018</a>'
      + `<table><tr><td>Component</td>${['S', 'M', 'ML', 'L', 'XL'].map((s) => `<td>${s}</td>`).join('')}<td></td></tr>${rows.map(tr).join('')}</table></body></html>`;
    const [e] = litespeed.extract({ url: 'https://litespeed.com/our-bikes/titanium/adventure/2018-gravel', timestamp: '20180130220721', related: {}, html });
    expect(e).toMatchObject({ model: 'Gravel', year: 2018, category: 'gravel' });
    expect(e.sizes.map((s) => s.size)).toEqual(['S', 'M', 'ML', 'L', 'XL']);
    expect(e.sizes[1]).toMatchObject({ stack: 565, reach: 377, wheelbase: 1019, bbDrop: 71, chainstay: 430 });
  });
  it('has nothing to read on a page without the table', () => {
    expect(litespeed.extract({ url: 'https://litespeed.com/products/flint', timestamp: '20230101000000', related: {}, html: '<html><head><title>Flint</title></head><body><h1>Flint</h1></body></html>' })).toEqual([]);
  });
  describe('accept', () => {
    it('takes bike and frame pages and groups them by frame', () => {
      expect(litespeed.accept('https://litespeed.com/products/arenberg-fi')).toEqual({ url: 'https://litespeed.com/products/arenberg-fi', family: 'arenberg' });
      expect(litespeed.accept('https://www.litespeed.com/collections/titanium-gravel-bikes/products/cherohala-frame?variant=123#geo')).toEqual({ url: 'https://litespeed.com/collections/titanium-gravel-bikes/products/cherohala-frame', family: 'cherohala' });
      expect(litespeed.accept('https://litespeed.com/products/ultimate-g2-fi-frame')).toEqual({ url: 'https://litespeed.com/products/ultimate-g2-fi-frame', family: 'ultimate-g2' });
      expect(litespeed.accept('https://litespeed.com/collections/titanium-road-bikes/products/litespeed-t2-frameset')).toEqual({ url: 'https://litespeed.com/collections/titanium-road-bikes/products/litespeed-t2-frameset', family: 't2' });
      expect(litespeed.accept('http://litespeed.com:80/our-bikes/titanium/adventure/2018-gravel')).toEqual({ url: 'https://litespeed.com/our-bikes/titanium/adventure/2018-gravel', family: 'gravel@2018' });
    });
    it('rejects builds, parts, pre-orders, city and mountain bikes, older model years and listings', () => {
      expect(litespeed.accept('https://litespeed.com/products/cherohala-city')).toBeNull();
      expect(litespeed.accept('https://litespeed.com/products/t5-disc-shimano-105-xs')).toBeNull();
      expect(litespeed.accept('https://litespeed.com/products/t1sl-disc-wheelsets')).toBeNull();
      expect(litespeed.accept('https://litespeed.com/products/flint-limited-edition')).toBeNull();
      expect(litespeed.accept('https://litespeed.com/products/ultimate-disc-fi-frame_pplr_1700093624_983377')).toBeNull();
      expect(litespeed.accept('https://litespeed.com/products/sustain')).toBeNull();
      expect(litespeed.accept('https://litespeed.com/collections/titanium-road-bikes')).toBeNull();
      expect(litespeed.accept('http://litespeed.com:80/our-bikes/titanium/mountain/2017-ahwi')).toBeNull();
      expect(litespeed.accept('http://litespeed.com:80/our-bikes/titanium/t-series/2017-t5-disc')).toBeNull();
      expect(litespeed.accept('http://litespeed.com:80/our-bikes/titanium/adventure/2018')).toBeNull();
    });
  });
});
