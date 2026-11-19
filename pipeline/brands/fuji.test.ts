import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fuji from './fuji';

const page = (file: string, url: string, timestamp = '20260101000000') => ({
  url, timestamp, related: {}, html: readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8'),
});

const keys = ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const;

describe('fuji', () => {
  it('reads a 2018-2022 site page: letters and centimetres from the header, no model year', () => {
    const [e, ...rest] = fuji.extract(page('fuji', 'https://www.fujibikes.com/usa/bikes/road/competition/sl-disc/sl-1-3-disc'));
    expect(rest).toEqual([]);
    expect([e.model, e.year, e.category]).toEqual(['SL', undefined, 'race']);
    expect(e.sizes.map((s) => s.size)).toEqual(['XXS 46', 'XS 49', 'S 52', 'M 54', 'L 56', 'XL 58', 'XXL 61']);
    const s = e.sizes.find((x) => x.size === 'M 54')!;
    // 'Headtube Angle' reads as the head tube angle, not its length; 'Seat Tube Center To Top' is the seat tube length.
    expect([s.stack, s.reach, s.headTubeAngle, s.seatTubeAngle, s.headTubeLength, s.seatTubeLength, s.chainstay, s.wheelbase, s.bbDrop])
      .toEqual([540, 385, 73, 73.5, 135, 500, 410, 978, 68]);
    for (const x of e.sizes) for (const k of keys) expect(x[k]).toBeGreaterThan(0);
  });

  it('reads a spec archive page: the model year is in the title', () => {
    const [e] = fuji.extract(page('fuji-archive', 'https://archive.fujibikes.com/2020/Fuji/jari-carbon-112'));
    expect([e.model, e.year, e.category]).toEqual(['Jari Carbon', 2020, 'gravel']);
    expect(e.sizes.map((s) => s.size)).toEqual(['XS 49', 'S 52', 'M 54', 'L 56', 'XL 58', 'XXL 61']);
    const s = e.sizes.find((x) => x.size === 'M 54')!;
    expect([s.stack, s.reach, s.headTubeAngle, s.seatTubeAngle, s.wheelbase]).toEqual([572, 370, 71.5, 73, 1016]);
    for (const x of e.sizes) for (const k of keys) expect(x[k]).toBeGreaterThan(0);
  });

  it('reads a Shopify page: the handle says the model year, the size guide gives the centimetres', () => {
    const url = 'https://www.fujibikes.com/products/2022-transonic-1-1';
    const [e] = fuji.extract(page('fuji-shop', url));
    expect([e.model, e.year, e.category]).toEqual(['Transonic', 2022, 'aero']);
    expect(e.sizes.map((s) => s.size)).toEqual(['XXS 46', 'XS 49', 'S 52', 'M 54', 'L 56', 'XL 58', 'XXL 61']);
    const s = e.sizes.find((x) => x.size === 'M 54')!;
    expect([s.stack, s.reach, s.headTubeAngle, s.seatTubeAngle, s.wheelbase]).toEqual([541, 392, 72.7, 74.2, 989]);
    for (const x of e.sizes) for (const k of keys) expect(x[k]).toBeGreaterThan(0);
  });

  it('dates a Shopify page only by what its handle states', () => {
    const p = page('fuji-shop', 'https://www.fujibikes.com/products/2022-transonic-1-1');
    const withHandle = (handle: string, timestamp = p.timestamp) => fuji.extract({
      ...p, timestamp, html: p.html.replace('2022-transonic-1-1', handle),
    })[0].year;
    expect(withHandle('transonic-11-22')).toBe(2022);
    expect(withHandle('jari-carbon-11-24')).toBe(2024);
    expect(withHandle('transonic-1-1')).toBeUndefined();
    // A trailing number later than the capture's next year is a build, not a year.
    expect(withHandle('transonic-23', '20190101000000')).toBeUndefined();
  });

  it('names the frame, not the build', () => {
    const p = page('fuji', 'https://www.fujibikes.com/usa/bikes/road/competition/sl-disc/sl-1-3-disc');
    const titled = (title: string) => fuji.extract({ ...p, html: p.html.replace('Fuji Bikes | SL 1.3 Disc', title) })[0]?.model;
    expect(titled('Fuji Bikes | SL 1.1 Disc')).toBe('SL');
    expect(titled('Fuji Bikes | 2021 SL-A Disc 1.1 | Bike Archives')).toBe('SL-A');
    expect(titled('Fuji Bikes | Roubaix 1.1 Disc')).toBe('Roubaix Disc');
    expect(titled('Fuji Bikes | Roubaix 1.1 W')).toBe('Roubaix W');
    expect(titled('Fuji Bikes | 2019 Transonic Rim 2.1 | Bike Archives')).toBe('Transonic');
    expect(titled('Fuji Bikes | 2019 Finest 1.3 Disc | Bike Archives')).toBe('Finest');
    expect(titled('Fuji Bikes | 2019 Finest 2.5 | Bike Archives')).toBe('Finest 2');
    expect(titled('Fuji Bikes | Jari Carbon CX')).toBe('Jari Carbon CX');
    // E-bikes, frames and time-trial bikes are not catalog models.
    expect(titled('Fuji Bikes | SL-E 1.1')).toBeUndefined();
    expect(titled('Fuji Bikes | Norcom Straight 1.1')).toBeUndefined();
    expect(titled('Fuji Bikes | Jari 1.1 Frameset')).toBeUndefined();
  });

  it('gives nothing without geometry, or with sizes it cannot tell apart', () => {
    const p = page('fuji-archive', 'https://archive.fujibikes.com/2020/Fuji/jari-carbon-112');
    expect(fuji.extract({ ...p, html: '<title>Fuji Bikes | 2020 Jari Carbon 1.1 | Bike Archives</title><table></table>' })).toEqual([]);
    expect(fuji.extract({ ...p, html: p.html.replace(/>\s*(?:XS|S|M|L|XL|XXL)\s*</g, '>0<').replace(/\d\dcm/g, '') })).toEqual([]);
  });

  it('accepts drop-bar product pages of every template', () => {
    expect(fuji.accept('http://www.fujibikes.com:80/usa/bikes/road/competition/sl-disc/sl-1-3-disc?x=1'))
      .toEqual({ url: 'https://www.fujibikes.com/usa/bikes/road/competition/sl-disc/sl-1-3-disc', family: 'sl' });
    expect(fuji.accept('https://fujibikes.com/usa/bikes/road/adventure-and-touring/jari-carbon/jari-carbon-1-1')?.family).toBe('jari-carbon');
    expect(fuji.accept('http://archive.fujibikes.com:80/2020/Fuji/jari-carbon-112#top'))
      .toEqual({ url: 'https://archive.fujibikes.com/2020/Fuji/jari-carbon-112', family: 'jari-carbon' });
    expect(fuji.accept('https://archive.fujibikes.com/2018/Fuji/roubaix-13-w')?.family).toBe('roubaix-w');
    expect(fuji.accept('https://www.fujibikes.com/products/jari-carbon-11-24?srsltid=x'))
      .toEqual({ url: 'https://www.fujibikes.com/products/jari-carbon-11-24', family: 'jari-carbon' });
    expect(fuji.accept('https://www.fujibikes.com/products/2022-jari-carbon-cx')?.family).toBe('jari-carbon-cx');
    expect(fuji.accept('https://www.fujibikes.com/products/sportif-11-disc-22')?.family).toBe('sportif-disc');
    expect(fuji.accept('https://www.fujibikes.com/products/transonic-21-22')?.family).toBe('transonic');
  });

  it('rejects e-bikes, flat-bar, mountain, time-trial, frames, parts and listings', () => {
    expect(fuji.accept('https://www.fujibikes.com/usa/bikes/road/competition/norcom-straight/norcom-straight-2-1')).toBeNull();
    expect(fuji.accept('https://www.fujibikes.com/usa/bikes/road/competition/sl/sl-1-1-frame')).toBeNull();
    expect(fuji.accept('https://www.fujibikes.com/usa/bikes/road/competition')).toBeNull();
    expect(fuji.accept('https://www.fujibikes.com/usa//bikes/road/competition/sl/sl-2-1')).toBeNull();
    expect(fuji.accept('https://archive.fujibikes.com/2019/Fuji/nevada-29-114')).toBeNull();
    expect(fuji.accept('https://archive.fujibikes.com/2021/Fuji/sl-e')).toBeNull();
    expect(fuji.accept('https://archive.fujibikes.com/2017/Fuji/jari-113')).toBeNull();
    expect(fuji.accept('https://www.fujibikes.com/products/e-jari-22')).toBeNull();
    expect(fuji.accept('https://www.fujibikes.com/products/jari-11-frame-22')).toBeNull();
    expect(fuji.accept('https://www.fujibikes.com/products/absolute-17-23')).toBeNull();
    expect(fuji.accept('https://www.fujibikes.com/products/headset-top-cap')).toBeNull();
    expect(fuji.accept('https://www.fujibikes.com/products/transonic-disc-my19-fork-steerer-stem-shim')).toBeNull();
  });
});
