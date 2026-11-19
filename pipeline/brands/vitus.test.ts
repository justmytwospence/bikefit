import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import vitus from './vitus';

const html = (file: string) => readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8');
const page = (file: string, url: string, edit: (h: string) => string = (h) => h) => ({
  url, timestamp: '20260101000000', related: {}, html: edit(html(file)),
});

const SIX = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

describe('vitus', () => {
  it('reads the Vitesse EVO page of 2022 (labels HT Angle and ST Angle, bare numbers)', () => {
    const found = vitus.extract(page('vitus', 'https://vitusbikes.com/products/vitus-vitesse-evo-crs-di2-road-bike-ultegra-2022'));
    expect(found).toHaveLength(1);
    const [e] = found;
    expect(e.model).toBe('Vitesse EVO');
    expect(e.year).toBe(2022);
    expect(e.category).toBe('race');
    expect(e.tyreWidth).toBe(30);
    expect(e.sizes.map((s) => s.size).sort()).toEqual([...SIX].sort());
    const m = e.sizes.find((x) => x.size === 'M')!;
    expect([m.stack, m.reach]).toEqual([547, 387]);
    expect(e.sizes[0]).toEqual({
      size: 'XS', seatTubeLength: 470, wheelbase: 983, headTubeLength: 105, headTubeAngle: 70.9, seatTubeAngle: 73.6, chainstay: 410,
      bbDrop: 70, stack: 503, reach: 376,
    });
    for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
  });

  it('reads the 2020 page and drops its wheelbase row, which holds reach values', () => {
    const [e] = vitus.extract(page('vitus-2020', 'https://vitusbikes.com/products/vitesse-evo-cr-road-bike-105'));
    expect(e.model).toBe('Vitesse EVO');
    expect(e.year).toBe(2020);
    expect(e.category).toBe('race');
    expect(e.sizes.map((s) => s.size).sort()).toEqual([...SIX].sort());
    const m = e.sizes.find((x) => x.size === 'M')!;
    expect([m.stack, m.reach]).toEqual([548, 382]);
    expect(m).toMatchObject({ seatTubeAngle: 73.5, headTubeAngle: 73, seatTubeLength: 500, chainstay: 415 });
    // The page's wheelbase cells read 372, 380, 385, 1000, 1012 and 1021: no size keeps one.
    for (const x of e.sizes) {
      expect(x.wheelbase).toBeUndefined();
      for (const k of ['seatTubeAngle', 'headTubeAngle'] as const) expect(x[k]).toBeGreaterThan(0);
    }
  });

  it('reads the Venon EVO frameset page (spelled-out labels) and drops its 5000 mm seat tube', () => {
    const [e] = vitus.extract(page('vitus-2023', 'https://vitusbikes.com/products/vitus-venon-evo-frameset-07e7'));
    expect(e.model).toBe('Venon EVO');
    expect(e.year).toBe(2023);
    expect(e.category).toBe('gravel');
    expect(e.tyreWidth).toBe(45);
    expect(e.sizes.map((s) => s.size).sort()).toEqual([...SIX].sort());
    const m = e.sizes.find((x) => x.size === 'M')!;
    expect([m.stack, m.reach]).toEqual([560, 387]);
    expect(m.seatTubeLength).toBeUndefined();
    expect(e.sizes.find((x) => x.size === 'L')!.seatTubeLength).toBe(520);
    expect(e.sizes[0]).toMatchObject({ size: 'XS', bbDrop: 71, chainstay: 420, headTubeLength: 102 });
    for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
  });

  it('names each frame from the chart the page points at, so the builds of a frame share a model', () => {
    const named = (geometry: string, title = 'Vitus Whatever Road Bike') => vitus.extract(page('vitus', 'https://vitusbikes.com/products/x',
      (h) => h.replace('2021-vitesse-evo-geometry', geometry).replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)))[0];
    expect(named('2021-zx-1-evo')).toMatchObject({ model: 'ZX-1 EVO', category: 'aero' });
    expect(named('geometry-2023-venon-evo')).toMatchObject({ model: 'Venon EVO', category: 'gravel' });
    expect(named('substance-alloy-geometry')).toMatchObject({ model: 'Substance', category: 'gravel' });
    expect(named('substance-carbon-geometry')).toMatchObject({ model: 'Substance Carbon', category: 'gravel' });
    expect(named('substance-steel-geometry')).toMatchObject({ model: 'Substance Steel', category: 'gravel' });
    expect(named('2021-energie-evo-geometry')).toMatchObject({ model: 'Energie EVO', category: 'cyclocross' });
    expect(named('2021-energie-alloy-geometry')).toMatchObject({ model: 'Energie', category: 'cyclocross' });
    expect(named('energie-carbon-geometry')).toMatchObject({ model: 'Energie Carbon', category: 'cyclocross' });
    expect(named('zenium-geometry')).toMatchObject({ model: 'Zenium', category: 'endurance' });
    expect(named('2021-razor-geometry')).toMatchObject({ model: 'Razor', category: 'endurance' });
    // With no tag the title decides; with neither there is no frame to name.
    const noTag = (title: string) => vitus.extract(page('vitus', 'https://vitusbikes.com/products/x',
      (h) => h.replace(/"Geometry Page: [^"]*"/, '"x"').replace(/<h1>.*<\/h1>/, `<h1>${title}</h1>`)));
    expect(noTag('Vitus Zenium CR Road Bike 105')[0].model).toBe('Zenium');
    expect(noTag('Vitus Mystery Bike')).toEqual([]);
  });

  it('reads the year only when the page states one', () => {
    const [e] = vitus.extract(page('vitus', 'https://vitusbikes.com/products/x', (h) => h.replace(/"Model Year: \d{4}",?/, '')));
    expect(e.year).toBeUndefined();
  });

  it('has nothing to read on a page without the chart', () => {
    expect(vitus.extract({ url: 'https://vitusbikes.com/products/vitus-zx-1-evo-frameset-2022', timestamp: '20220527000000', related: {},
      html: '<html><head><title>Vitus ZX-1 EVO</title></head><body><h1>Vitus ZX-1 EVO</h1><img src="/geo.png"></body></html>' })).toEqual([]);
  });

  describe('accept', () => {
    it('takes Shopify product pages and groups them by frame', () => {
      expect(vitus.accept('https://vitusbikes.com/products/vitus-vitesse-evo-crs-di2-road-bike-ultegra-2022'))
        .toEqual({ url: 'https://vitusbikes.com/products/vitus-vitesse-evo-crs-di2-road-bike-ultegra-2022', family: 'vitesse-evo' });
      expect(vitus.accept('https://vitusbikes.com/products/vitus-zx-1-evo-force-axs-road-bike-2026?variant=43261688283355'))
        .toEqual({ url: 'https://vitusbikes.com/products/vitus-zx-1-evo-force-axs-road-bike-2026', family: 'zx-1-evo' });
      expect(vitus.accept('http://vitusbikes.com:80/products/zx1-cr-road-bike-105')?.family).toBe('zx-1-evo');
      expect(vitus.accept('https://vitusbikes.com/products/vitus-substance-grx-gravel-bike-2026')?.family).toBe('substance');
      expect(vitus.accept('https://vitusbikes.com/products/vitus-substance-crx-1-adventure-road-bike')?.family).toBe('substance-carbon');
      expect(vitus.accept('https://vitusbikes.com/products/substance-srs-2-adventure-road-bike')?.family).toBe('substance-steel');
      expect(vitus.accept('https://vitusbikes.com/products/vitus-energie-evo-rival-cyclocross-bike-07e7')?.family).toBe('energie-evo');
      expect(vitus.accept('https://vitusbikes.com/products/vitus-venon-evo-rs-force-axs-aero-all-road-bike-copy')?.family).toBe('venon-evo');
      expect(vitus.accept('https://vitusbikes.com/products/vitus-razor-w-disc-road-bike-claris-2022')?.family).toBe('razor');
    });
    it('rejects e-bikes, kids, flat-bar, time-trial, mountain, WordPress, duplicate and non-product pages', () => {
      expect(vitus.accept('https://vitusbikes.com/products/vitus-e-substance-carbon-e-road-bike-fazua-2022')).toBeNull();
      expect(vitus.accept('https://vitusbikes.com/products/vitus-energie-24-youth-cx-bike-2022')).toBeNull();
      expect(vitus.accept('https://vitusbikes.com/products/vitus-razor-disc-flat-bar-road-bike-claris-2022')).toBeNull();
      expect(vitus.accept('https://vitusbikes.com/products/vitus-zenium-carbon-c-fb-road-bike-07e7')).toBeNull();
      expect(vitus.accept('https://vitusbikes.com/products/vitus-zx-1-team-etap-axs-carbon-tt-bike')).toBeNull();
      expect(vitus.accept('https://vitusbikes.com/products/vitus-rapide-29-crs-mountain-bike-2022')).toBeNull();
      expect(vitus.accept('http://vitusbikes.com:80/products/zenium-vr-disc-2018/')).toBeNull();
      expect(vitus.accept('https://vitusbikes.com/products/copy-of-vitus-zx-1-evo-crs-etap-axs-road-bike-force')).toBeNull();
      expect(vitus.accept('https://vitusbikes.com/pages/2021-zx-1-evo')).toBeNull();
      expect(vitus.accept('https://vitusbikes.com/collections/road-bikes')).toBeNull();
    });
  });
});
