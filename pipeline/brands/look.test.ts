import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import look from './look';
import type { Adapter } from '../types';

const page = (file: string, url: string) => ({
  url, timestamp: '20260101000000', related: {}, html: readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8'),
});

const BLADE_2023 = 'https://www.lookcycle.com/us-en/products/bikes/road-bikes/aero/795-blade-rs-2023-frameset';
const BLADE_2021 = 'https://www.lookcycle.com/us-en/products/bikes/road-bikes/aero/795-blade-rs-2021-frameset';
const GRAVEL_2019 = 'https://www.lookcycle.com/us-en/products/bikes/gravel-bikes/gravel/765-gravel-rs-black-red-glossy';
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

/** Look pages never give wheelbase or BB drop: the build estimates them. */
function check(a: Adapter, file: string, url: string, model: string, category: string, year: number | undefined, sizes: string[], one: [string, number, number]) {
  const found = a.extract(page(file, url));
  expect(found).toHaveLength(1);
  const [e] = found;
  expect(e.model).toBe(model);
  expect(e.category).toBe(category);
  expect(e.year).toBe(year);
  expect(e.sizes.map((s) => s.size).sort()).toEqual([...sizes].sort());
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) {
    for (const k of ['seatTubeAngle', 'headTubeAngle', 'headTubeLength', 'seatTubeLength', 'chainstay'] as const) expect(x[k]).toBeGreaterThan(0);
    expect(x.wheelbase).toBeUndefined();
    expect(x.bbDrop).toBeUndefined();
  }
}

describe('look', () => {
  it('reads the Blade RS 2 frameset, decimal commas and all', () => {
    check(look, 'look', BLADE_2023, '795 Blade RS 2', 'aero', 2023, SIZES, ['XS', 505, 370]);
    const [e] = look.extract(page('look', BLADE_2023));
    // Only the desktop table: the phone copy repeats it one size at a time.
    expect(e.sizes).toHaveLength(5);
    // Head tube 71,75 deg, seat tube 478,3, head tube 90,4; front centre, trail, fork, top tube, HAV and standover go.
    expect(e.sizes[0]).toEqual({
      size: 'XS', stack: 505, reach: 370, headTubeAngle: 71.8, seatTubeAngle: 74.5, seatTubeLength: 478, chainstay: 410, headTubeLength: 90,
    });
    expect(e.sizes[4]).toMatchObject({ size: 'XL', stack: 601, reach: 410, headTubeAngle: 73, seatTubeAngle: 74.5 });
  });
  it('reads the 2019 template, whose seat rows say seat post', () => {
    check(look, 'look-2019', GRAVEL_2019, '765 Gravel RS', 'gravel', undefined, SIZES, ['XS', 530, 355]);
    const [e] = look.extract(page('look-2019', GRAVEL_2019));
    expect(e.sizes[0]).toMatchObject({ headTubeAngle: 70.3, seatTubeAngle: 74, seatTubeLength: 470, chainstay: 420, headTubeLength: 112 });
  });
  it('names the first Blade RS by its geometry, and its year from the heading', () => {
    check(look, 'look-2021', BLADE_2021, '795 Blade RS', 'aero', 2021, SIZES, ['XS', 505, 367]);
    // Its disc frame has 415 mm chainstays, and some later build pages show it under the plain name.
    const p = page('look-2021', 'https://www.lookcycle.com/us-en/products/bikes/road-bikes/aero/795-blade-rs-proteam-black-ultra-mat-glossy');
    const disc = p.html.replace('<title>795 BLADE RS 2021 FRAMESET', '<title>x').replace('>795 BLADE RS 2021 FRAMESET<', '>795 BLADE RS Proteam Black Ultra Mat Glossy<')
      .replace(/data-value="405">405</g, 'data-value="415">415<');
    const [e] = look.extract({ ...p, html: disc });
    expect([e.model, e.year]).toEqual(['795 Blade RS Disc', undefined]);
  });
  it('reads the Blade RS 3 heading with its superscript, and French row labels', () => {
    const p = page('look', 'https://www.lookcycle.com/us-en/products/bikes/road-bikes/aero/795-blade-rs-3-frameset');
    const html = p.html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/, '<h1>795 Blade<sup>RS</sup> 3 - Frameset</h1>')
      .replace(/I - Head tube/g, 'I - Tube de direction').replace(/J - Seat tube/g, 'J - Tube de selle').replace(/A - Seat tube/g, 'A - Tube de selle')
      .replace(/K - Head tube/g, 'K - Tube de direction').replace(/G - Chainstays/g, 'G - Bases');
    const [e] = look.extract({ ...p, html });
    expect([e.model, e.year, e.category]).toEqual(['795 Blade RS 3', undefined, 'aero']);
    expect(e.sizes).toEqual(look.extract(page('look', BLADE_2023))[0].sizes);
  });
  it('has nothing to read on landing pages, e-bikes and other frames', () => {
    expect(look.extract({ url: 'https://www.lookcycle.com/us-en/products/bikes/road-bikes/altitude/785-huez-rs', timestamp: '20260616123628', related: {}, html: '<html><head><title>785 Huez RS - LOOK Cycle</title></head><body><h1>785 Huez RS</h1></body></html>' })).toEqual([]);
    const p = page('look-2019', GRAVEL_2019);
    expect(look.extract({ ...p, html: p.html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/, '<h1>E-765 GRAVEL GREEN MAT</h1>') })).toEqual([]);
    expect(look.extract({ ...p, html: p.html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/, '<h1>796 Monoblade RS Frameset</h1>') })).toEqual([]);
  });
  describe('accept', () => {
    it('takes product pages of every era and groups them by frame', () => {
      expect(look.accept(GRAVEL_2019)).toEqual({ url: GRAVEL_2019, family: '765-gravel-rs' });
      expect(look.accept('http://www.lookcycle.com:80/us-en/products/bikes/road-bikes/aero/795-blade-rs/795-blade-rs-frameset?utm=x'))
        .toEqual({ url: 'https://www.lookcycle.com/us-en/products/bikes/road-bikes/aero/795-blade-rs/795-blade-rs-frameset', family: '795-blade-rs' });
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/gravel-bikes765-gravel-rs/765-gravel-rs-frameset'))
        .toEqual({ url: 'https://www.lookcycle.com/us-en/products/bikes/gravel-bikes765-gravel-rs/765-gravel-rs-frameset', family: '765-gravel-rs' });
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/road-bikes/endurance/765-optimum-frameset-charcoal-satin')?.family).toBe('765-optimum');
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/road-bikes/endurance/765-optimum-disc-black-glossy')?.family).toBe('765-optimum-disc');
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/gravel-bikes/gravel/g85-cezal-frameset')?.family).toBe('g85-cezal');
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/road-bikes/aero/795-blade-rs-3-frameset')?.family).toBe('795-blade-rs-3');
      expect(look.accept('https://www.lookcycle.com/us-en/products/blade-rs-2/795-blade-rs-iconic-edition-frameset')?.family).toBe('795-blade-rs-2');
    });
    it('rejects e-bikes, TT, track, listings, landing pages and the configurator', () => {
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/gravel-bikes/e-gravel/e-765-gravel-green-mat')).toBeNull();
      expect(look.accept('https://www.lookcycle.com/us-en/products/gravel/gravel-bikes/e-765-gravel-dark-bronze-glossy')).toBeNull();
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/e-bike/e-765-optimum')).toBeNull();
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/triathlon-bikes/795-blade-rs-tt/795-blade-rs-proteam-white-full-glossy')).toBeNull();
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/road-bikes/aero/796-monoblade-rs-frameset')).toBeNull();
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/track-bikes/875-madison-rs')).toBeNull();
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/road-bikes/aero?sort=price_asc')).toBeNull();
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/road-bikes/aero/795-blade-rs')).toBeNull();
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/road-bikes/altitude/785-huez-rs')).toBeNull();
      expect(look.accept('https://www.lookcycle.com/us-en/products/bikes/road-bikes/aero/795-blade-rs/customize')).toBeNull();
      expect(look.accept('https://www.lookcycle.com/en/velo/795-blade-rs/')).toBeNull();
    });
  });
});
