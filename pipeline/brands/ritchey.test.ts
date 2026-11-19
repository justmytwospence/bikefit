import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ritchey from './ritchey';
import type { FrameCategory } from '../../src/data/schema';

const page = (file: string, url: string) => ({
  url, timestamp: '20260101000000', related: {}, html: readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8'),
});

function check(file: string, url: string, model: string, category: FrameCategory, sizes: string[], one: [string, number, number]) {
  const found = ritchey.extract(page(file, url));
  expect(found).toHaveLength(1);
  const [e] = found;
  expect(e.model).toBe(model);
  expect(e.category).toBe(category);
  expect(e.sizes.map((s) => s.size)).toEqual(sizes);
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
  return e;
}

const LETTERS = ['XS', 'S', 'M', 'L', 'XL'];

describe('ritchey', () => {
  it('reads the Montebello frameset page from its page data', () => {
    const e = check('ritchey', 'https://ritcheylogic.com/bike/frames/montebello-frameset', 'Montebello', 'endurance', [...LETTERS, 'XXL'], ['M', 593, 390]);
    expect(e.year).toBeUndefined();
    // Seat tube (c-t) is the seat tube; top tube, standover, fork and post rows are not read.
    expect(e.sizes[2]).toEqual({
      size: 'M', seatTubeLength: 515, seatTubeAngle: 74, headTubeLength: 160, headTubeAngle: 72, bbDrop: 80, chainstay: 429,
      wheelbase: 1029, stack: 593, reach: 390,
    });
  });
  it('keeps the Disc of the Road Logic Disc on a /product/ page', () => {
    const e = check('ritchey-product', 'https://ritcheylogic.com/product/road-logic-disc-frameset', 'Road Logic Disc', 'race', ['51cm', '53cm', '55cm', '57cm', '59cm'], ['55cm', 570, 394]);
    expect(e.year).toBeUndefined();
    expect(e.sizes[0]).toMatchObject({ seatTubeAngle: 74.5, headTubeAngle: 72.5, headTubeLength: 120 });
  });
  it('reads the model year the earlier Outback page states', () => {
    const url = 'https://ritcheylogic.com/bike/frames/outback-frameset-my2023';
    const e = check('ritchey-my2023', url, 'Outback', 'gravel', LETTERS, ['L', 587, 390]);
    expect(e.year).toBe(2023);
    const p = page('ritchey-my2023', url);
    // Later captures of the same page name it 'Outback frameset 23/24'.
    expect(ritchey.extract({ ...p, html: p.html.replace('"name":"Outback frameset MY2023"', '"name":"Outback frameset 23/24"') })[0])
      .toMatchObject({ model: 'Outback', year: 2023 });
  });
  it('names editions and Break-Away frames by their frame', () => {
    const p = page('ritchey-my2023', 'https://ritcheylogic.com/bike/frames/outback-50th-anniversary-frameset');
    const named = (name: string) => ritchey.extract({ ...p, html: p.html.replace('"name":"Outback frameset MY2023"', `"name":"${name}"`) })[0];
    expect(named('Outback 50th Anniversary Frameset')).toMatchObject({ model: 'Outback', year: undefined });
    expect(named('Septimer Break-Away Carbon Frameset').model).toBe('Septimer Break-Away');
    expect(named('Break-Away Road Logic frameset').model).toBe('Break-Away Road Logic');
  });
  it('has nothing to read on a page that only links the PDF', () => {
    const html = '<html><head><title>Ritchey Road Logic Disc Frameset / Road Bikes</title></head><body><h1>Road Logic Disc Frameset</h1>'
      + '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"data":{"product":{"name":"Road Logic Disc Frameset","technicalData":null}}}}}</script></body></html>';
    expect(ritchey.extract({ url: 'https://ritcheylogic.com/bike/frames/road-logic-disc-frameset', timestamp: '20221209202617', related: {}, html })).toEqual([]);
  });
  describe('accept', () => {
    it('takes frameset pages on both paths and groups editions with their frame', () => {
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/montebello-frameset')).toEqual({ url: 'https://ritcheylogic.com/bike/frames/montebello-frameset', family: 'montebello' });
      expect(ritchey.accept('http://www.ritcheylogic.com:80/product/road-logic-disc-frameset?srsltid=abc')).toEqual({ url: 'https://ritcheylogic.com/product/road-logic-disc-frameset', family: 'road-logic-disc' });
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/septimer-break-away-carbon-frameset')).toEqual({ url: 'https://ritcheylogic.com/bike/frames/septimer-break-away-carbon-frameset', family: 'septimer-break-away-carbon' });
      expect(ritchey.accept('https://ritcheylogic.com/product/swiss-cross-disc-frameset')?.family).toBe('swiss-cross-disc');
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/swiss-cross-50th-anniversary-frameset')?.family).toBe('swiss-cross-disc');
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/outback-50th-anniversary-frameset')?.family).toBe('outback');
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/outback-frameset-my2023')?.family).toBe('outback@2023');
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/break-away-road-logic-frameset')?.family).toBe('break-away-road-logic');
    });
    it('rejects mountain, tandem and urban frames, blems, demos, parts and listings', () => {
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/ultra-frameset')).toBeNull();
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/p-29er-frame')).toBeNull();
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/outback-tandm-frameset')).toBeNull();
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/garden-city-frameset')).toBeNull();
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/road-logic-frameset-53cm-blem-97352836A01')).toBeNull();
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/road-logic-complete-55-demo-99352000A01')).toBeNull();
      expect(ritchey.accept('https://ritcheylogic.com/product/outback-frameset-24')).toBeNull();
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames/break-away-bike-travel-bag-deluxe-with-wheels')).toBeNull();
      expect(ritchey.accept('https://ritcheylogic.com/bike/frames')).toBeNull();
      expect(ritchey.accept('https://ritcheylogic.com/gravel-bike/frames')).toBeNull();
    });
  });
});
