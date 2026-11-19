import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import genesis from './genesis';
import type { Adapter } from '../types';

const page = (file: string, url: string) => ({
  url, timestamp: '20190915133416', related: {}, html: readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8'),
});

function check(a: Adapter, file: string, url: string, model: string, category: string, sizes: string[], one: [string, number, number]) {
  const found = a.extract(page(file, url));
  expect(found).toHaveLength(1);
  const [e] = found;
  expect(e.model).toBe(model);
  expect(e.category).toBe(category);
  expect(e.year).toBeUndefined();
  expect(e.sizes.map((s) => s.size)).toEqual(sizes);
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

describe('genesis', () => {
  it('reads a 2019 product page and names the frame, not the build', () => {
    check(genesis, 'genesis', 'https://www.genesisbikes.co.uk/bike/croix-de-fer-30-2020', 'Croix de Fer', 'gravel', SIZES, ['S', 572, 375]);
    const [e] = genesis.extract(page('genesis', 'https://www.genesisbikes.co.uk/bike/croix-de-fer-30-2020'));
    expect(e.sizes[0]).toEqual({
      size: 'XS', seatTubeLength: 470, headTubeLength: 115, headTubeAngle: 71, seatTubeAngle: 74, chainstay: 430, bbDrop: 73, wheelbase: 1007,
      reach: 365, stack: 553,
    });
    expect(e.sizes[4]).toMatchObject({ size: 'XL', stack: 633, reach: 405 });
  });
  it('reads another frame of the same template', () => {
    check(genesis, 'genesis-2019', 'https://www.genesisbikes.co.uk/bike/cda-10', 'CDA', 'cyclocross', SIZES, ['M', 581, 386]);
  });
  it('reads a 2018 geometry fragment, named by its id', () => {
    check(genesis, 'genesis-2018', 'https://www.genesisbikes.co.uk/ajax-details.php?id=delta-20', 'Delta', 'endurance', SIZES, ['L', 599, 395]);
    const [e] = genesis.extract(page('genesis-2018', 'https://www.genesisbikes.co.uk/ajax-details.php?id=delta-20'));
    // 'Chanstay Length' is the maker's typo, and the angles end in a degree sign.
    expect(e.sizes[0]).toEqual({
      size: 'XS', seatTubeLength: 460, headTubeLength: 130, headTubeAngle: 71, seatTubeAngle: 74, chainstay: 420, bbDrop: 72, wheelbase: 992,
      reach: 365, stack: 538,
    });
  });
  it('has nothing to read on a page without the table', () => {
    const html = '<html><head><title>Delta 20 | Genesis</title></head><body><h1 class="product-name">Delta 20</h1></body></html>';
    expect(genesis.extract({ url: 'https://www.genesisbikes.co.uk/bike/delta-20-2020', timestamp: '20191114044527', related: {}, html })).toEqual([]);
    expect(genesis.extract({ url: 'https://www.genesisbikes.co.uk/ajax-details.php?id=tarn-20', timestamp: '20180206214322', related: {}, html: '<h1><img src="/img/bikes/logo/tarn-20.svg"></h1>' })).toEqual([]);
  });
  describe('accept', () => {
    it('takes drop-bar product pages and groups them by frame and era', () => {
      expect(genesis.accept('https://www.genesisbikes.co.uk/bike/croix-de-fer-30-2020')).toEqual({
        url: 'https://www.genesisbikes.co.uk/bike/croix-de-fer-30-2020', family: 'croix-de-fer-2020',
      });
      expect(genesis.accept('http://www.genesisbikes.co.uk:80/bike/equilibrium-disc-10?utm_source=x#top')).toEqual({
        url: 'https://www.genesisbikes.co.uk/bike/equilibrium-disc-10', family: 'equilibrium-disc',
      });
      expect(genesis.accept('https://www.genesisbikes.co.uk/bike/croix-de-fer-ti-fs')).toEqual({
        url: 'https://www.genesisbikes.co.uk/bike/croix-de-fer-ti-fs', family: 'croix-de-fer-ti',
      });
      expect(genesis.accept('https://www.genesisbikes.co.uk/ajax-details.php?id=delta-20')).toEqual({
        url: 'https://www.genesisbikes.co.uk/ajax-details.php?id=delta-20', family: 'delta',
      });
    });
    it('rejects flat-bar, mountain, e-bike, touring and listing pages', () => {
      expect(genesis.accept('https://www.genesisbikes.co.uk/bike/croix-de-fer-10-flat-bar-2020')).toBeNull();
      expect(genesis.accept('https://www.genesisbikes.co.uk/bike/tarn-20')).toBeNull();
      expect(genesis.accept('https://www.genesisbikes.co.uk/bike/columbia-rd')).toBeNull();
      expect(genesis.accept('https://www.genesisbikes.co.uk/bike/tour-de-fer-20')).toBeNull();
      expect(genesis.accept('https://www.genesisbikes.co.uk/bike/zeal-10')).toBeNull();
      expect(genesis.accept('https://www.genesisbikes.co.uk/ajax-details.php?id=tarn-fs')).toBeNull();
      expect(genesis.accept('https://www.genesisbikes.co.uk/bikes/croix-de-fer?color_family=231555')).toBeNull();
      expect(genesis.accept('https://www.genesisbikes.co.uk/bikes/adventure/adventure/croix-de-fer/croix-de-fer-30')).toBeNull();
      expect(genesis.accept('https://www.genesisbikes.co.uk/product/genesis-croix-de-fer-30-gn10911md/GN10911MD')).toBeNull();
    });
  });
});
