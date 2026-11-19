import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import norco from './norco';

const page = (file: string, url: string) => ({
  url, timestamp: '20260101000000', related: {}, html: readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8'),
});

function check(file: string, url: string, model: string, sizes: string[], one: [string, number, number], year?: number) {
  const [e] = norco.extract(page(file, url));
  expect(e.model).toBe(model);
  expect(e.year).toBe(year);
  expect(e.category).toBe('gravel');
  expect(e.sizes.map((s) => s.size).sort()).toEqual([...sizes].sort());
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) {
    for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase', 'headTubeLength', 'seatTubeLength', 'chainstay', 'bbDrop'] as const) expect(x[k]).toBeGreaterThan(0);
  }
  return e;
}

describe('norco', () => {
  it('reads the inline JSON of pages from 2021 on', () => {
    const e = check('norco', 'https://www.norco.com/bikes/road/gravel/search-carbon/25-search-c-grx/', 'Search Carbon', ['1', '2', '3', '4', '5'], ['1', 554, 385], 2025);
    const s = e.sizes.find((x) => x.size === '1')!;
    expect([s.seatTubeAngle, s.headTubeAngle, s.wheelbase, s.bbDrop]).toEqual([74.5, 69.5, 1037, 75]);
  });
  it('reads the two wheel-size tables of 2018 to 2021 pages', () => {
    const e = check('norco-2019', 'https://www.norco.com/bikes/2019/dirt-dropbar/gravel/search-xr-carbon/search-xr-carbon-apex-1/', 'Search XR Carbon',
      ['45.5', '48', '50.5', '53', '55.5', '58', '60.5'], ['45.5', 504, 355], 2019);
    // 'Bottom Bracket Rise/Drop' is negative on the page.
    expect(e.sizes.find((x) => x.size === '45.5')!.bbDrop).toBe(57);
  });
  it('reads the 2018 table with its letter column, without a model year', () => {
    check('norco-2018', 'http://www.norco.com:80/bikes/road/adventure/search-xr-carbon/search-xr-apex-1/', 'Search XR Carbon',
      ['45.5', '48', '50.5', '53', '55.5', '58', '60.5'], ['45.5', 504, 355]);
  });
  it('finds no geometry on a page without a table', () => {
    const url = 'https://www.norco.com/bikes/road/gravel/search-carbon/25-search-c-grx/';
    expect(norco.extract({ ...page('norco', url), html: '<html><title>Choose your language and region | Norco Bicycles</title></html>' })).toEqual([]);
    expect(norco.extract(page('norco', 'https://www.norco.com/bikes/road/gravel/'))).toEqual([]);
  });
  it('accepts and rejects urls', () => {
    expect(norco.accept('https://www.norco.com/bikes/2019/dirt-dropbar/gravel/search-xr-carbon/search-xr-carbon-apex-1/?x=1'))
      .toEqual({ url: 'https://www.norco.com/bikes/2019/dirt-dropbar/gravel/search-xr-carbon/search-xr-carbon-apex-1/', family: 'search-xr-carbon@2019' });
    expect(norco.accept('http://www.norco.com:80/bikes/road/adventure/search-xr-carbon/search-xr-apex-1/'))
      .toEqual({ url: 'https://www.norco.com/bikes/road/adventure/search-xr-carbon/search-xr-apex-1/', family: 'search-xr-carbon@2018' });
    expect(norco.accept('https://www.norco.com/bikes/road/gravel/search-carbon/25-search-c-grx/')?.family).toBe('search-carbon@2025');
    expect(norco.accept('https://www.norco.com/bikes/road/gravel/search/27-search-a1/')?.family).toBe('search-aluminum@2027');
    // Frames are named by the slug: a Search Carbon page sat in the XR directory in 2018, the frame/fork pages share a frame.
    expect(norco.accept('https://www.norco.com/bikes/2018/dirt-dropbar/gravel/search-xr-carbon/search-c-105/')?.family).toBe('search-carbon@2018');
    expect(norco.accept('https://www.norco.com/bikes/2020/road/cyclocross/threshold-carbon/threshold-c-frame-fork/')?.family).toBe('threshold-carbon@2020');
    expect(norco.accept('https://www.norco.com/bikes/road/gravel/search-aluminum/25-search-a-fb/')).toBeNull();
    expect(norco.accept('https://www.norco.com/bikes/2019/pavement/urban/indie-drop-aluminum/indie-drop-claris/')).toBeNull();
    expect(norco.accept('https://www.norco.com/bikes/2019/pavement/endurance/valence-aluminum/valence-aluminum-105-womens/')).toBeNull();
    expect(norco.accept('https://www.norco.com/bikes/road/gravel/')).toBeNull();
    expect(norco.accept('https://www.norco.com/bikes/2019/dirt-dropbar/gravel/search-xr-carbon/?bike-404=1')).toBeNull();
    expect(norco.accept('https://www.norco.com/bikes/mountain/trail/optic-carbon/optic-c1/')).toBeNull();
  });
});
