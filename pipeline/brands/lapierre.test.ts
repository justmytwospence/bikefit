import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import lapierre from './lapierre';
import type { Adapter } from '../types';
import type { FrameCategory } from '../../src/data/schema';

const page = (file: string, url: string) => ({
  url, timestamp: '20260806000000', related: {}, html: readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8'),
});

function check(
  a: Adapter, file: string, url: string, model: string, category: FrameCategory, sizes: string[], one: [string, number, number],
) {
  const found = a.extract(page(file, url));
  expect(found).toHaveLength(1);
  const [e] = found;
  expect(e.model).toBe(model);
  expect(e.category).toBe(category);
  // No page states a model year.
  expect(e.year).toBeUndefined();
  expect(e.sizes.map((s) => s.size)).toEqual(sizes);
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
}

describe('lapierre', () => {
  it('reads the Xelius DRS page, from a build title in lower case', () => {
    const url = 'https://lapierrebikes.com/en-int/products/xelius-drs-80-lxdtb';
    check(lapierre, 'lapierre', url, 'Xelius DRS', 'race', ['XS', 'S', 'M', 'L', 'XL', 'XXL'], ['XS', 501, 376]);
    const [e] = lapierre.extract(page('lapierre', url));
    // Millimetres and degrees, the drawing's letters dropped; the top tube row is not a measurement the catalog keeps.
    expect(e.sizes[0]).toEqual({
      size: 'XS', seatTubeLength: 440, headTubeLength: 105, headTubeAngle: 72, seatTubeAngle: 74, chainstay: 405, wheelbase: 969,
      stack: 501, reach: 376, bbDrop: 67,
    });
    expect(e.sizes[5]).toMatchObject({ size: 'XXL', stack: 599, reach: 428, wheelbase: 1032, headTubeAngle: 74 });
  });
  it('reads the Aerostorm DRS page, with decimal wheelbases rounded', () => {
    const url = 'https://lapierrebikes.com/en-int/products/aerostorm-drs-lfata';
    check(lapierre, 'lapierre-aerostorm', url, 'Aerostorm DRS', 'aero', ['S', 'M', 'L', 'XL'], ['M', 500, 395]);
    const [e] = lapierre.extract(page('lapierre-aerostorm', url));
    expect(e.sizes.map((s) => s.wheelbase)).toEqual([957, 978, 1002, 1027]);
    expect(e.sizes.map((s) => s.bbDrop)).toEqual([68, 68, 68, 68]);
  });
  it('reads the Crosshill CF page as a gravel frame', () => {
    const url = 'https://lapierrebikes.com/en-int/products/crosshill-cf-80-lchua';
    check(lapierre, 'lapierre-crosshill', url, 'Crosshill CF', 'gravel', ['XS', 'S', 'M', 'L', 'XL', 'XXL'], ['L', 601, 386]);
    const [e] = lapierre.extract(page('lapierre-crosshill', url));
    expect(e.sizes[0]).toMatchObject({ size: 'XS', headTubeAngle: 70.5, seatTubeAngle: 73.5, chainstay: 430, bbDrop: 71 });
  });
  it('names the frame by its line, not the build', () => {
    const p = page('lapierre', 'https://lapierrebikes.com/en-int/products/xelius-drs-80-lxdtb');
    const as = (title: string, url = p.url) => lapierre.extract({ ...p, url, html: p.html.replace(/xelius DRS 8\.0/g, title) })[0]?.model;
    expect(as('Xélius DRS 5.0')).toBe('Xelius DRS');
    expect(as('Pulsium 6.0 AXS')).toBe('Pulsium');
    expect(as('Sensium 3.0 Disc')).toBe('Sensium');
    expect(as('Crosshill AL 3.0')).toBe('Crosshill AL');
    expect(as('Crosshill 2.0')).toBe('Crosshill AL');
    expect(as('Crosshill CF 9.0')).toBe('Crosshill CF');
    expect(as('Overvolt AM 7.8')).toBeUndefined();
    expect(as('Zesty AM 9.0', 'https://lapierrebikes.com/en-int/products/zesty-am-70-lzbva')).toBeUndefined();
  });
  it('has nothing to read on a page without the table', () => {
    const html = '<html><head><title>Xelius DRS 8.0</title></head><body><h1>Xelius DRS 8.0</h1><img src="/Geo-Xelius-DRS.jpg"></body></html>';
    expect(lapierre.extract({ url: 'https://www.lapierrebikes.com/de-en/o/xelius-sl-80-2022/', timestamp: '20220519030126', related: {}, html })).toEqual([]);
  });
  describe('accept', () => {
    it('takes product pages and groups them by frame', () => {
      expect(lapierre.accept('https://lapierrebikes.com/en-int/products/xelius-drs-80-lxdtb')).toEqual({
        url: 'https://lapierrebikes.com/en-int/products/xelius-drs-80-lxdtb', family: 'xelius-drs',
      });
      expect(lapierre.accept('https://lapierrebikes.com/en-int/products/pulsium-60-axs-lppuc?variant=45297334026287')).toEqual({
        url: 'https://lapierrebikes.com/en-int/products/pulsium-60-axs-lppuc', family: 'pulsium',
      });
      expect(lapierre.accept('http://lapierrebikes.com/en-int/products/crosshill-cf-50-lceua')).toEqual({
        url: 'https://lapierrebikes.com/en-int/products/crosshill-cf-50-lceua', family: 'crosshill-cf',
      });
      expect(lapierre.accept('https://lapierrebikes.com/en-int/products/crosshill-30-lcbua')?.family).toBe('crosshill');
      expect(lapierre.accept('https://lapierrebikes.com/en-int/products/aerostorm-drs-lfata')?.family).toBe('aerostorm-drs');
      expect(lapierre.accept('https://lapierrebikes.com/en-int/products/sensium-30-disc-lshpb')?.family).toBe('sensium');
    });
    it('rejects e-bikes, mountain bikes, oembed copies, frame kits, listings and the old shop', () => {
      expect(lapierre.accept('https://lapierrebikes.com/en-int/products/overvolt-am-78-lopta')).toBeNull();
      expect(lapierre.accept('https://lapierrebikes.com/en-int/products/e-explorer-55-llbub')).toBeNull();
      expect(lapierre.accept('https://lapierrebikes.com/en-int/products/aerostorm-drs-lfata.oembed')).toBeNull();
      expect(lapierre.accept('https://lapierrebikes.com/en-int/products/frame-kit-xelius-drs-80th-anniversary')).toBeNull();
      expect(lapierre.accept('https://lapierrebikes.com/en-int/products/zesty-am-70-lzbva')).toBeNull();
      expect(lapierre.accept('https://lapierrebikes.com/en-int/products/crosshill-30-flat-lcbna')).toBeNull();
      expect(lapierre.accept('https://lapierrebikes.com/en-int/products/')).toBeNull();
      expect(lapierre.accept('https://lapierrebikes.com/en-int/collections/road')).toBeNull();
      expect(lapierre.accept('https://www.lapierrebikes.com/de-en/o/aerostorm-drs-2024/')).toBeNull();
    });
  });
});
