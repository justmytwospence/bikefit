import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import marin from './marin';
import type { Extracted, Page } from '../types';

const fixture = (file: string) => readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8');
const page = (file: string, url: string): Page => ({ url, timestamp: '20260101000000', related: {}, html: fixture(file) });

function check(p: Page, model: string, sizes: string[], one: [string, number, number]): Extracted {
  const [e] = marin.extract(p);
  expect(e.model).toBe(model);
  expect(e.sizes.map((s) => s.size)).toEqual(sizes);
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
  return e;
}
const row = (e: Extracted, size: string) => {
  const s = e.sizes.find((x) => x.size === size)!;
  return [s.headTubeAngle, s.headTubeLength, s.seatTubeAngle, s.seatTubeLength, s.chainstay, s.wheelbase, s.bbDrop];
};

describe('marin', () => {
  it('reads the store page (late 2025 on), dated by its product name', () => {
    // https://marinbikes.com/products/2026-gestalt-2 at 20260823131559.
    const e = check(page('marin', 'https://marinbikes.com/products/2026-gestalt-2'), 'Gestalt', ['50', '52', '54', '56', '58', '60'], ['50', 552, 367]);
    expect([e.year, e.category]).toEqual([2026, 'gravel']);
    // 'Headtube angle' is the head angle, not the head tube's length; 'Seattube angle' and 'Seattube length' map too.
    expect(row(e, '50')).toEqual([71, 120, 74.5, 460, 432, 1008, 78]);
  });

  it('reads the model-year page (2023 to 2025), dated by its path', () => {
    // https://www.marinbikes.com/bikes/2024-nicasio-2 at 20231023050906: the title states no year.
    const e = check(page('marin-bikes', 'https://www.marinbikes.com/bikes/2024-nicasio-2'), 'Nicasio 2', ['50', '52', '54', '56', '58', '60'], ['54', 575, 375]);
    expect([e.year, e.category]).toEqual([2024, 'gravel']);
    expect(row(e, '54')).toEqual([71, 155, 74, 510, 420, 1015, 72]);
  });

  it('reads the 2018 and 2019 pages: sizes in cm, upper-case labels, virtual and actual seat angles', () => {
    // https://www.marinbikes.com/bikes/2018-nicasio at 20201204103745: size 47 reads 534.57 and 349.75.
    const e = check(page('marin-2018', 'https://www.marinbikes.com/bikes/2018-nicasio'), 'Nicasio', ['47', '50', '52', '54', '56', '58', '60'], ['47', 535, 350]);
    expect([e.year, e.category]).toEqual([2018, 'gravel']);
    expect(row(e, '47')).toEqual([70, 125, 74.5, 440, 420, 993, 72]);
  });

  it('names the frame, not the build, and takes the year the page states', () => {
    const named = (html: string, url = 'https://marinbikes.com/products/x') => marin.extract({ ...page('marin', url), html })[0];
    const store = fixture('marin');
    expect(named(store.replace('Name: "2026 Gestalt 2"', 'Name: "2025 Gestalt XR"'))).toMatchObject({ model: 'Gestalt X', year: 2025 });
    expect(named(store.replace('Name: "2026 Gestalt 2"', 'Name: "2025.1 Nicasio 3"'))).toMatchObject({ model: 'Nicasio 2', year: 2025 });
    expect(named(store.replace('Name: "2026 Gestalt 2"', 'Name: "2025.1 Headlands Frame Kit"'))).toMatchObject({ model: 'Headlands', year: 2025 });
    expect(named(store.replace('Name: "2026 Gestalt 2"', 'Name: "Four Corners 1 (CUES)"')).year).toBeUndefined();
    const old = fixture('marin-2018');
    const url = 'https://www.marinbikes.com/bikes/2019-cortina-ax2';
    expect(named(old.replace('2018 Nicasio', '2019 Cortina AX2'), url)).toMatchObject({ model: 'Cortina', year: 2019, category: 'cyclocross' });
    expect(named(old.replace('2018 Nicasio', '2018 Argenta Comp'), url)).toMatchObject({ model: 'Argenta', year: 2018, category: 'endurance' });
    expect(named(old.replace('2018 Nicasio', '2020 Nicasio+'), url).model).toBe('Nicasio');
  });

  it('finds no drop-bar geometry on flat-bar, e-bike and geometry-less pages', () => {
    const none = (html: string) => marin.extract({ ...page('marin', 'https://marinbikes.com/products/x'), html });
    // The Nicasio RC's spec: a swept-back city bar.
    expect(none(fixture('marin-2018').replace('Compact 12º Flared Drop', 'Marin Alloy Swept-Back City Bar, 31.8mm Clamp'))).toEqual([]);
    expect(none(fixture('marin').replace('"Drop Bar",', '"Flat Bar",'))).toEqual([]);
    expect(none(fixture('marin').replace('Name: "2026 Gestalt 2"', 'Name: "2025.1 Lombard E1"'))).toEqual([]);
    expect(none(fixture('marin').replace(/<table[\s\S]*<\/table>/, ''))).toEqual([]);
  });

  it('accepts drop-bar product pages, one family per line and model year', () => {
    expect(marin.accept('https://marinbikes.com/products/2026-gestalt-2?variant=4711'))
      .toEqual({ url: 'https://marinbikes.com/products/2026-gestalt-2', family: 'gestalt@2026' });
    expect(marin.accept('http://www.marinbikes.com/bikes/2024-nicasio-2'))
      .toEqual({ url: 'https://www.marinbikes.com/bikes/2024-nicasio-2', family: 'nicasio-2@2024' });
    expect(marin.accept('https://marinbikes.com/products/2024-gestalt-xr-copy'))
      .toEqual({ url: 'https://marinbikes.com/products/2024-gestalt-xr-copy', family: 'gestalt-x@2024' });
    expect(marin.accept('https://marinbikes.com/products/2025-1-headlands-1')?.family).toBe('headlands@2025');
    expect(marin.accept('https://www.marinbikes.com/bikes/20-headlands-2')?.family).toBe('headlands@2020');
    expect(marin.accept('https://marinbikes.com/products/headlands-3')?.family).toBe('headlands');
    expect(marin.accept('https://www.marinbikes.com/bikes/2018-hawk-hill-2')).toBeNull();
    expect(marin.accept('https://www.marinbikes.com/bikes/2022-dsx-1')).toBeNull();
    expect(marin.accept('https://marinbikes.com/products/2025-1-lombard-e1')).toBeNull();
    expect(marin.accept('https://www.marinbikes.com/bikes/family/gestalt')).toBeNull();
    expect(marin.accept('https://www.marinbikes.com/bikes/2019-nicasio-rc')).toBeNull();
    expect(marin.accept('https://www.marinbikes.com/bikes/2017-nicasio')).toBeNull();
  });
});
