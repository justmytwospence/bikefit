import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import jamis from './jamis';

const page = (file: string, url: string) => ({
  url, timestamp: '20260101000000', related: {}, html: readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8'),
});

const keys = ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const;

describe('jamis', () => {
  it('reads a 2018 Muse page: millimetres of inch / millimetre cells, no model year', () => {
    const [e, ...rest] = jamis.extract(page('jamis', 'http://www.jamisbikes.com:80/usa/xenithcomp.html'));
    expect(rest).toEqual([]);
    expect([e.model, e.year, e.category]).toEqual(['Xenith', undefined, 'race']);
    expect(e.sizes.map((s) => s.size)).toEqual(['48', '51', '54', '56', '58', '61']);
    const s = e.sizes.find((x) => x.size === '54')!;
    expect([s.stack, s.reach, s.headTubeAngle, s.seatTubeAngle, s.chainstay, s.wheelbase, s.bbDrop, s.headTubeLength])
      .toEqual([542, 378, 73, 73, 405, 967, 68, 140]);
    for (const x of e.sizes) for (const k of keys) expect(x[k]).toBeGreaterThan(0);
  });

  it('reads a 2021 WordPress page: one frame per build group, dated by its table', () => {
    const models = jamis.extract(page('jamis-2021', 'https://www.jamisbikes.com/bikes/adventure-gravel/allroad-adventure/renegade/'));
    // S4 repeats S3's rows, so it is not a model of its own; S2 and S3 differ in a few cells.
    expect(models.map((m) => m.model)).toEqual(['Renegade Carbon', 'Renegade Steel S2', 'Renegade Steel S3', 'Renegade Alloy']);
    expect(models.map((m) => [m.year, m.category])).toEqual(Array(4).fill([2021, 'gravel']));
    const carbon = models[0];
    expect(carbon.sizes.map((s) => s.size)).toEqual(['48', '51', '54', '56', '58', '61']);
    const c54 = carbon.sizes.find((x) => x.size === '54')!;
    expect([c54.stack, c54.reach, c54.headTubeAngle, c54.seatTubeAngle, c54.wheelbase]).toEqual([565, 378, 71.5, 73, 1023]);
    // The smallest sizes are labelled '44 650' (650b wheels) on the page: size 44.
    const steel = models[1];
    expect(steel.sizes.map((s) => s.size)).toEqual(['44', '48', '51', '54', '56', '58', '61']);
    const s44 = steel.sizes.find((x) => x.size === '44')!;
    expect([s44.stack, s44.reach]).toEqual([505, 351]);
    for (const m of models) for (const x of m.sizes) for (const k of keys) expect(x[k]).toBeGreaterThan(0);
  });

  it('reads a 2026 WordPress page: seat tube length, two geometries of one family named by their builds', () => {
    const models = jamis.extract(page('jamis-2026', 'https://www.jamisbikes.com/bikes/adventure-gravel/gravel-adventure/steel-renegade/'));
    expect(models.map((m) => m.model)).toEqual(['Renegade Steel S1/S2', 'Renegade Steel S3/S4']);
    expect(models.map((m) => m.year)).toEqual([undefined, undefined]);
    const [a, b] = models;
    expect(a.sizes.map((s) => s.size)).toEqual(['48', '51', '54', '56', '58', '61']);
    const a54 = a.sizes.find((x) => x.size === '54')!;
    expect([a54.stack, a54.reach, a54.seatTubeLength, a54.chainstay]).toEqual([575, 380, 510, 450]);
    // S1/S2 are the steel frame with a longer reach in the smallest sizes.
    expect([a.sizes[0].reach, b.sizes[0].reach]).toEqual([370, 360]);
    for (const m of models) for (const x of m.sizes) for (const k of keys) expect(x[k]).toBeGreaterThan(0);
  });

  it('returns nothing for a page without geometry', () => {
    expect(jamis.extract({ ...page('jamis', 'https://www.jamisbikes.com/bikes/adventure-gravel/road/ventura/'), html: '<html><title>Ventura</title></html>' })).toEqual([]);
  });

  it('accepts drop-bar product pages and canonicalises them', () => {
    expect(jamis.accept('http://www.jamisbikes.com:80/usa/xenithcomp.html?x=1'))
      .toEqual({ url: 'https://www.jamisbikes.com/usa/xenithcomp.html', family: 'xenith' });
    expect(jamis.accept('http://www.jamisbikes.com:80/usa/renegadeelite.html'))
      .toEqual({ url: 'https://www.jamisbikes.com/usa/renegadeelite.html', family: 'renegade-carbon' });
    expect(jamis.accept('https://www.jamisbikes.com/bikes/adventure-gravel/gravel-adventure/carbon-renegade/#specs'))
      .toEqual({ url: 'https://www.jamisbikes.com/bikes/adventure-gravel/gravel-adventure/carbon-renegade/', family: 'renegade-carbon' });
    expect(jamis.accept('https://www.jamisbikes.com/bikes/adventure-gravel/road/ventura'))
      .toEqual({ url: 'https://www.jamisbikes.com/bikes/adventure-gravel/road/ventura/', family: 'ventura' });
  });

  it('rejects other bikes, series pages, frame kits and listings', () => {
    expect(jamis.accept('http://www.jamisbikes.com:80/usa/xenithseries.html')).toBeNull();
    expect(jamis.accept('http://www.jamisbikes.com:80/usa/venturacompfemme.html')).toBeNull();
    expect(jamis.accept('http://www.jamisbikes.com:80/usa/dakarxc.html')).toBeNull();
    expect(jamis.accept('http://www.jamisbikes.com:80/usa/allegrosport.html')).toBeNull();
    expect(jamis.accept('https://www.jamisbikes.com/bikes/adventure-gravel/gravel-adventure/renegade-frames/')).toBeNull();
    expect(jamis.accept('https://www.jamisbikes.com/bikes/adventure-gravel/all-road/')).toBeNull();
    expect(jamis.accept('https://www.jamisbikes.com/bikes/e-bikes/hudson-e1/')).toBeNull();
  });
});
