import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import surly from './surly';
import type { Adapter, Extracted } from '../types';

const html = (file: string) => readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8');
const page = (file: string, url: string) => ({ url, timestamp: '20260101000000', related: {}, html: html(file) });

function check(e: Extracted, model: string, category: Extracted['category'], sizes: string[], one: [string, number, number]) {
  expect(e.model).toBe(model);
  expect(e.category).toBe(category);
  // Surly pages state no model year.
  expect(e.year).toBeUndefined();
  expect(e.sizes.map((s) => s.size)).toEqual(sizes);
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
}

const extract = (a: Adapter, file: string, url: string) => a.extract(page(file, url));

describe('surly', () => {
  it('reads the shop page of a Midnight Special', () => {
    const found = extract(surly, 'surly', 'https://surlybikes.com/products/midnight-special-700c-stainless-teal');
    expect(found).toHaveLength(1);
    check(found[0], 'Midnight Special', 'endurance', ['40cm', '46cm', '50cm', '54cm', '56cm', '58cm', '60cm', '64cm'], ['56cm', 580, 393]);
    // Rows lead with the drawing's letter (G. Headtube Angle, E. Total Seat Tube Length): every measurement is read.
    expect(found[0].sizes[4]).toEqual({
      size: '56cm', reach: 393, stack: 580, seatTubeLength: 560, headTubeLength: 140, headTubeAngle: 73, seatTubeAngle: 73,
      bbDrop: 65, chainstay: 425, wheelbase: 1012,
    });
  });
  it('reads both wheel sizes of an old-site Disc Trucker page as two frames', () => {
    const found = extract(surly, 'surly-2023', 'https://surlybikes.com/bikes/_bike_info/disc_trucker');
    expect(found.map((e) => e.model)).toEqual(['Disc Trucker 26in', 'Disc Trucker 700c']);
    // Inch values sit beside the millimetres in every cell; only the millimetres are read.
    check(found[0], 'Disc Trucker 26in', 'gravel', ['42cm', '46cm', '50cm', '52cm', '54cm', '56cm'], ['42cm', 515, 362]);
    check(found[1], 'Disc Trucker 700c', 'gravel', ['56cm', '58cm', '60cm', '62cm', '64cm'], ['58cm', 632, 391]);
  });
  it('reads the old template of 2019', () => {
    const found = extract(surly, 'surly-2019', 'https://surlybikes.com/bikes/legacy/pacer');
    expect(found).toHaveLength(1);
    check(found[0], 'Pacer', 'endurance', ['42cm', '46cm', '50cm', '52cm', '54cm', '56cm', '58cm', '60cm', '62cm'], ['56cm', 557, 395]);
    expect(found[0].sizes[0]).toMatchObject({ seatTubeAngle: 75.5, headTubeAngle: 71, wheelbase: 981, chainstay: 410, bbDrop: 72 });
  });
  it('names a one-wheel shop page by its handle', () => {
    const p = page('surly-2023', 'https://surlybikes.com/products/disc-trucker-700c-frameset-hi-viz-black');
    // The tab panels say which table is which; with one table the handle does.
    const one = p.html.replace(/<div id="geo-26-1"[\s\S]*?<\/table>/, '').replace(/id="geo-700c-2"/, '');
    expect(surly.extract({ ...p, html: one }).map((e) => e.model)).toEqual(['Disc Trucker 700c']);
  });
  it('skips flat-bar tables', () => {
    const p = page('surly-2023', 'https://surlybikes.com/bikes/_bike_info/disc_trucker');
    expect(surly.extract({ ...p, html: p.html.replace('id="geo-26-1"', 'id="geo-flat-bar-1"') }).map((e) => e.model)).toEqual(['Disc Trucker 700c']);
  });
  it('has nothing to read on a page without a table', () => {
    const empty = '<html><head><title>Midnight Special | Surly Bikes</title></head><body><h1>Midnight Special</h1><div id="info-body"></div></body></html>';
    expect(surly.extract({ url: 'https://surlybikes.com/bikes/midnight_special', timestamp: '20180218013839', related: {}, html: empty })).toEqual([]);
    expect(extract(surly, 'surly', 'https://surlybikes.com/products/steamroller-frameset-frank-or-beans')).toEqual([]);
  });
  describe('accept', () => {
    it('takes product pages of both sites and groups them by frame', () => {
      expect(surly.accept('https://surlybikes.com/bikes/midnight_special')).toEqual({ url: 'https://surlybikes.com/bikes/midnight_special', family: 'midnight-special' });
      expect(surly.accept('http://www.surlybikes.com:80/bikes/cross_check?crosscheck.html')).toEqual({ url: 'https://surlybikes.com/bikes/cross_check', family: 'cross-check' });
      expect(surly.accept('https://surlybikes.com/bikes/_bike_info/disc_trucker/')).toEqual({ url: 'https://surlybikes.com/bikes/_bike_info/disc_trucker', family: 'disc-trucker' });
      expect(surly.accept('https://surlybikes.com/bikes/legacy/long_haul_trucker')).toEqual({ url: 'https://surlybikes.com/bikes/legacy/long_haul_trucker', family: 'long-haul-trucker' });
      expect(surly.accept('https://surlybikes.com/bikes/ghost_grappler?utm_campaign=GhostGrappler')).toEqual({ url: 'https://surlybikes.com/bikes/ghost_grappler', family: 'grappler' });
      expect(surly.accept('https://surlybikes.com/products/midnight-special-700c-stainless-teal')).toEqual({ url: 'https://surlybikes.com/products/midnight-special-700c-stainless-teal', family: 'midnight-special' });
      expect(surly.accept('https://surlybikes.com/products/preamble-drop-bar-red-hot-cheddar?variant=1')).toEqual({ url: 'https://surlybikes.com/products/preamble-drop-bar-red-hot-cheddar', family: 'preamble' });
      expect(surly.accept('https://surlybikes.com/products/bridge_club_2018')).toEqual({ url: 'https://surlybikes.com/products/bridge_club_2018', family: 'bridge-club' });
    });
    it('keeps the wheel sizes of a shop frame apart', () => {
      expect(surly.accept('https://surlybikes.com/products/disc-trucker-26-grandpas-khakis')?.family).toBe('disc-trucker-26in');
      expect(surly.accept('https://surlybikes.com/products/disc-trucker-700c-frameset-hi-viz-black')?.family).toBe('disc-trucker-700c');
      expect(surly.accept('https://surlybikes.com/products/straggler-650b-black')?.family).toBe('straggler-650b');
      expect(surly.accept('https://surlybikes.com/products/straggler-frameset-shaggy-carpet')?.family).toBe('straggler');
    });
    it('rejects flat-bar, single-speed, MTB, parts, listings and generations older than the catalog', () => {
      expect(surly.accept('https://surlybikes.com/products/preamble-flat-bar-best-buds-green')).toBeNull();
      expect(surly.accept('https://surlybikes.com/products/steamroller-frameset-frank-or-beans')).toBeNull();
      expect(surly.accept('https://surlybikes.com/bikes/steamroller?steamroller.html')).toBeNull();
      expect(surly.accept('https://surlybikes.com/bikes/krampus')).toBeNull();
      expect(surly.accept('https://surlybikes.com/products/krampus-frameset-first-loser')).toBeNull();
      expect(surly.accept('https://surlybikes.com/products/midnight-special-fork')).toBeNull();
      expect(surly.accept('https://surlybikes.com/products/cross-check-frame-dropout-screws')).toBeNull();
      expect(surly.accept('https://surlybikes.com/products/disc-trucker-decal-set')).toBeNull();
      expect(surly.accept('https://surlybikes.com/products/midnight-special-700c-black-cherry-fizz.js')).toBeNull();
      expect(surly.accept('https://surlybikes.com/bikes/_frame_highlights/midnight_special')).toBeNull();
      expect(surly.accept('https://surlybikes.com/bikes/midnight_special%22')).toBeNull();
      expect(surly.accept('https://surlybikes.com/bikes/touring')).toBeNull();
      expect(surly.accept('https://surlybikes.com/bikes/legacy')).toBeNull();
      expect(surly.accept('https://surlybikes.com/bikes/legacy/long_haul_trucker_2007')).toBeNull();
      expect(surly.accept('https://surlybikes.com/products/cross_check_2000')).toBeNull();
    });
  });
});
