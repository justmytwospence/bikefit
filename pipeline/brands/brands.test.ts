import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import canyon from './canyon';
import cervelo from './cervelo';
import giant from './giant';
import specialized from './specialized';
import trek from './trek';
import scott from './scott';
import bianchi from './bianchi';
import pinarello from './pinarello';
import orbea from './orbea';
import ribble from './ribble';
import colnago from './colnago';
import bmc from './bmc';
import cube from './cube';
import merida from './merida';
import cannondale from './cannondale';
import liv from './liv';
import factor from './factor';
import wilier from './wilier';
import focus from './focus';
import argon18 from './argon-18';
import type { Adapter } from '../types';

const page = (file: string, url: string) => ({
  url, timestamp: '20260101000000', related: {}, html: readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8'),
});

function check(a: Adapter, file: string, url: string, model: string, sizes: string[], one: [string, number, number]) {
  const [e] = a.extract(page(file, url));
  expect(e.model).toBe(model);
  expect(e.sizes.map((s) => s.size).sort()).toEqual([...sizes].sort());
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
}

describe('adapters', () => {
  it('specialized', () => check(specialized, 'specialized', 'https://www.specialized.com/us/en/tarmac-sl9-expert/p/1', 'Tarmac SL9', ['44', '49', '52', '54', '56', '58', '61'], ['44', 501, 366]));
  it('canyon', () => check(canyon, 'canyon', 'https://www.canyon.com/en-us/road-bikes/race-bikes/ultimate/cf-slx/ultimate-cf-slx-8-di2/4372.html', 'Ultimate CF SLX', ['2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL'], ['L', 580, 401]));
  it('canyon geometry table, before product data', () => {
    const url = 'https://www.canyon.com/en-us/gravel-bikes/race/grail/cf-slx/grail-cf-slx-9-etap/2738.html';
    check(canyon, 'canyon-table', url, 'Grail CF SLX', ['2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL'], ['2XS', 470, 384]);
    const [e] = canyon.extract(page('canyon-table', url));
    expect(e.category).toBe('gravel');
    expect(e.sizes.find((s) => s.size === 'M')!.bbDrop).toBeGreaterThan(40);
    expect(canyon.extract(page('canyon-table', 'https://www.canyon.com/en-us/gravel-bikes/cyclocross/inflite/x/1.html'))[0].category).toBe('cyclocross');
    const named = (title: string) => canyon.extract({ ...page('canyon-table', url), html: page('canyon-table', url).html.replace(/<title>[^<]*/, `<title>${title} | CANYON US`) })[0].model;
    expect(named('Grail CF SLX 8 AXS RS')).toBe('Grail CF SLX');
    expect(named('GRIZL CF SLX 8 eTap')).toBe('Grizl CF SLX');
    expect(named('Grizl 7 RAW')).toBe('Grizl');
  });
  it('giant', () => check(giant, 'giant', 'https://www.giant-bicycles.com/us/tcr-advanced-pro-1-di2-2025', 'TCR Advanced', ['XS', 'S', 'M', 'ML', 'L', 'XL'], ['XS', 517, 376]));
  it('giant with drawing letters, before 2022', () => {
    check(giant, 'giant-code', 'https://www.giant-bicycles.com/us/contend-sl-2-disc-2019', 'Contend SL', ['S', 'M', 'ML', 'L', 'XL'], ['S', 546, 373]);
  });
  it('accepts and rejects urls', () => {
    expect(specialized.accept('https://www.specialized.com/us/en/turbo-creo-sl/p/1')).toBeNull();
    expect(specialized.accept('https://www.specialized.com/us/en/s-works-tarmac-sl9-sram-red/p/22?x=1')?.family).toBe('tarmac-sl9');
    expect(canyon.accept('https://www.canyon.com/en-us/road-bikes/race-bikes/ultimate/cf-slx/ultimate-cf-slx-8-di2/4372.html?a=1')?.url)
      .toBe('https://www.canyon.com/en-us/road-bikes/race-bikes/ultimate/cf-slx/ultimate-cf-slx-8-di2/4372.html');
    expect(giant.accept('https://www.giant-bicycles.com/us/tcr-advanced-pro-1-di2-2025')?.family).toBe('tcr-advanced');
    expect(giant.accept('https://www.giant-bicycles.com/us/talon-3-2025')).toBeNull();
  });
  it('trek', () => {
    check(trek, 'trek', 'https://www.trekbikes.com/us/en_US/bikes/road-bikes/performance-road-bikes/domane/domane-slr/domane-slr-7-gen-4/p/57892/',
      'Domane Gen 4', ['47', '50', '52', '54', '56', '58', '60', '62'], ['56', 591, 377]);
    expect(trek.accept('https://www.trekbikes.com/us/en_US/bikes/road-bikes/performance-road-bikes/madone/madone-slr/madone-slr-9-axs-gen-7/p/37420/?colorCode=red'))
      .toEqual({ url: 'https://www.trekbikes.com/us/en_US/bikes/road-bikes/performance-road-bikes/madone/madone-slr/madone-slr-9-axs-gen-7/p/37420/', family: 'madone-slr-9-gen7' });
    expect(trek.accept('https://www.trekbikes.com/us/en_US/bikes/road-bikes/performance-road-bikes/domane/domane-lt/domane-lt-7-gen-2/p/35759/')).toBeNull();
    expect(trek.accept('https://www.trekbikes.com/us/en_US/equipment/bike-accessories/bontrager-elite-recycled-water-bottle-cage/p/26138/')).toBeNull();
  });
  it('cervelo', () => {
    check(cervelo, 'cervelo', 'https://www.cervelo.com/en-US/bikes/s5', 'S5', ['48', '51', '54', '56', '58'], ['54', 542, 384]);
    expect(cervelo.accept('https://www.cervelo.com/en/road/s-series/s5/specs%20and%20geometry')?.family).toBe('s5');
    expect(cervelo.accept('https://www.cervelo.com/en-US/bikes/caledonia-5-2023?x=1')?.url).toBe('https://www.cervelo.com/en-US/bikes/caledonia-5-2023');
    expect(cervelo.accept('https://www.cervelo.com/en-US/bikes/rouvida')).toBeNull();
    expect(cervelo.accept('https://www.cervelo.com/en/gear/parts/s5-bar-stem')).toBeNull();
  });
  it('scott', () => {
    check(scott, 'scott', 'https://www.scott-sports.com/us/en/product/scott-addict-rc-ultimate-bike', 'Addict RC',
      ['XXS 47', 'XS 49', 'S 52', 'M 54', 'L 56', 'XL 58', 'XXL 61'], ['M 54', 548, 390]);
    expect(scott.accept('https://www.scott-sports.com/us/en/product/scott-addict-rc-15-disc-bike?article=269861021'))
      .toEqual({ url: 'https://www.scott-sports.com/us/en/product/scott-addict-rc-15-disc-bike', family: 'us-addict-rc-15-disc-bike' });
    expect(scott.accept('https://www.scott-sports.com/us/en/product/scott-addict-eride-10-bike')).toBeNull();
    expect(scott.accept('https://www.scott-sports.com/us/en/product/scott-foil-rc-ultimate-shoe')).toBeNull();
  });
  it('bianchi', () => {
    check(bianchi, 'bianchi', 'https://www.bianchi.com/store/int_EN/ytb7d-infinito-10512sp-2.html', 'Infinito',
      ['470', '500', '530', '550', '570', '590', '610'], ['530', 553, 377]);
    expect(bianchi.accept('https://www.bianchi.com/shop/bikes/road/aero/oltre/oltre-rc-4/?v=1'))
      .toEqual({ url: 'https://www.bianchi.com/shop/bikes/road/aero/oltre/oltre-rc-4/', family: 'oltre-rc' });
    expect(bianchi.accept('https://www.bianchi.com/store/int_EN/e-omnia-t-type-xt-1x12sp.html')).toBeNull();
    expect(bianchi.accept('https://www.bianchi.com/store/int_EN/casa-bianchi-coffee-table-book.html')).toBeNull();
  });
  it('pinarello', () => {
    // Pinarello tables carry no wheelbase.
    const [e] = pinarello.extract(page('pinarello', 'https://pinarello.com/global/en/bikes/road/competition/dogma-f/dogma-f-dura-ace-di2'));
    expect(e.model).toBe('Dogma F');
    expect(e.sizes.map((s) => s.size)).toEqual(['430', '465', '500', '515', '530', '540', '550', '560', '575', '595', '620']);
    const s = e.sizes.find((x) => x.size === '430')!;
    expect([s.stack, s.reach, s.seatTubeAngle, s.headTubeAngle]).toEqual([502, 351, 74.4, 69.5]);
    expect(pinarello.accept('http://pinarello.com:80/en/bikes-2019/road/dogma-f10?set_language=en'))
      .toEqual({ url: 'https://www.pinarello.com/en/bikes-2019/road/dogma-f10', family: 'dogma-f10' });
    expect(pinarello.accept('https://pinarello.com/global/en/bikes/road/supercharged/nytro-e-road/nytro-e5-road-105-di2')).toBeNull();
    expect(pinarello.accept('https://pinarello.com/global/en/shop/apparel-man/dogma-f-man')).toBeNull();
  });
  it('orbea', () => {
    check(orbea, 'orbea', 'https://www.orbea.com/us-en/bicycles/road/orca/cat/orca-m20iteam-2024', 'Orca',
      ['47', '49', '51', '53', '55', '57', '60'], ['47', 506, 370]);
    expect(orbea.accept('https://www.orbea.com/us-en/bicycles/road/terra/cat/terra-h30-1x/?x=1'))
      .toEqual({ url: 'https://www.orbea.com/us-en/bicycles/road/terra/cat/terra-h30-1x', family: 'terra-h' });
    expect(orbea.accept('https://www.orbea.com/us-en/bicycles/orca-aero-m20team/geometry/')?.family).toBe('orca-aero:geometry');
    expect(orbea.accept('https://www.orbea.com/en-us/gain-m30')).toBeNull();
    expect(orbea.accept('https://www.orbea.com/en-us/oc-alu-sl-handlebar-rp21')).toBeNull();
  });
  it('ribble', () => {
    check(ribble, 'ribble', 'https://www.ribblecycles.co.uk/ribble-allroad-sl-r/', 'Allroad SL R', ['XS', 'S', 'M', 'L', 'XL'], ['M', 568, 376]);
    expect(ribble.accept('https://www.ribblecycles.co.uk/ribble-endurance-sl-r-series-disc-enthusiast/?x=1'))
      .toEqual({ url: 'https://www.ribblecycles.co.uk/ribble-endurance-sl-r-series-disc-enthusiast/', family: 'endurance-sl-r-disc' });
    expect(ribble.accept('https://www.ribblecycles.co.uk/ribble-endurance-sl-e-sport/')).toBeNull();
    expect(ribble.accept('https://www.ribblecycles.co.uk/ribble-2019-endurance-sle-hanger-black-one-size/')).toBeNull();
  });
  it('colnago', () => {
    // Colnago lists no wheelbase.
    const [e] = colnago.extract(page('colnago', 'https://www.colnago.com/en-us/premium-bikes/c68-road-bike/technical-specifications'));
    expect(e.model).toBe('C68 Road');
    expect(e.sizes.map((s) => s.size)).toEqual(['420', '455', '485', '510', '530', '550', '570']);
    const s = e.sizes.find((x) => x.size === '420')!;
    expect([s.stack, s.reach, s.seatTubeAngle, s.headTubeAngle, s.headTubeLength]).toEqual([510, 370, 75.5, 70.6, 103]);
    expect(colnago.accept('https://www.colnago.com/bike-product/detail/V3Rs?lang=en')).toEqual({ url: 'https://www.colnago.com/bike-product/detail/V3Rs', family: 'v3rs' });
    expect(colnago.accept('https://www.colnago.com/en-us/products/v5rs-headset-parts-kit')).toBeNull();
    expect(colnago.accept('https://www.colnago.com/en-us/products/tt1-bike')).toBeNull();
  });
  it('bmc', () => {
    check(bmc, 'bmc', 'https://bmc-switzerland.com/products/teammachine-slr-01-two-bikes-bmc-24-10608-004', 'Teammachine SLR',
      ['47', '51', '54', '56', '58', '61'], ['54', 550, 386]);
    expect(bmc.extract(page('bmc', 'https://bmc-switzerland.com/products/x'))[0].sizes[0].chainstay).toBe(410);
    expect(bmc.accept('https://bmc-switzerland.com/products/kaius-01-one-bikes-bmc-26a-000036?_pos=1'))
      .toEqual({ url: 'https://bmc-switzerland.com/products/kaius-01-one-bikes-bmc-26a-000036', family: 'kaius-01@shop' });
    expect(bmc.accept('https://www.bmc-switzerland.com/intl_en/bmc-teammachine-slr01-four-22.html')?.family).toBe('teammachine-slr-01@store');
    expect(bmc.accept('https://bmc-switzerland.com/products/roadmachine-01-amp-one-bikes-bmc-24-10304-001')).toBeNull();
    expect(bmc.accept('https://bmc-switzerland.com/products/headset-urs-01-hiride-bike-spare-parts-bmc-22-10802-088')).toBeNull();
  });
  it('cube', () => {
    check(cube, 'cube', 'https://www.cube.eu/uk-en/cube-nuroad-c-62-pro-swampgrey-n-black/680300', 'Nuroad C:62',
      ['XS', 'S', 'M', 'L', 'XL'], ['M', 578, 389]);
    expect(cube.accept('https://www.cube.eu/cube-litening-aero-c-68x-race-teamline/127110?x=1'))
      .toEqual({ url: 'https://www.cube.eu/cube-litening-aero-c-68x-race-teamline/127110', family: 'litening-aero-c68x' });
    expect(cube.accept('https://www.cube.eu/2021/bikes/road/offroad/nuroad/cube-nuroad-c62-pro-carbonnred/')?.family).toBe('nuroad-c62@old');
    expect(cube.accept('https://www.cube.eu/uk-en/cube-nuroad-hybrid-c-62-slt-400x-solareclipse-n-bronze/af4f610daf196c1eeaa45314382051e4')).toBeNull();
    expect(cube.accept('https://www.cube.eu/cube-agree-storage-box/12823')).toBeNull();
  });
  it('merida', () => {
    check(merida, 'merida', 'https://www.merida-bikes.com/en/bike/5637/scultura-10k', 'Scultura',
      ['3XS', 'XXS', 'XS', 'S', 'M', 'L', 'XL'], ['M', 557, 395]);
    expect(merida.accept('https://www.merida-bikes.com/en/bike/3106/scultura-endurance-9000?x=1'))
      .toEqual({ url: 'https://www.merida-bikes.com/en/bike/3106/scultura-endurance-9000', family: 'scultura-endurance' });
    expect(merida.accept('https://www.merida-bikes.com/en/bike/609/escultura-9000')).toBeNull();
    expect(merida.accept('https://www.merida-bikes.com/en/bike/2001/reacto-track-500')).toBeNull();
  });
  it('cannondale', () => {
    const url = 'https://www.cannondale.com/en-us/bikes/road/race/supersix-evo/supersix-evo-carbon-disc-105';
    const api = 'https://www.cannondale.com/en-us/api/products/6481-2021';
    const p = page('cannondale', url);
    expect(cannondale.related!(p.html, url)).toEqual([api]);
    expect(cannondale.extract(p)).toEqual([]);
    const json = readFileSync(join(__dirname, '..', 'fixtures', 'cannondale-api.json'), 'utf8');
    const [e] = cannondale.extract({ ...p, related: { [api]: json } });
    expect([e.model, e.year, e.category]).toEqual(['SuperSix EVO', 2021, 'race']);
    expect(e.sizes.map((s) => s.size)).toEqual(['44', '48', '51', '54', '56', '58', '60', '62']);
    const s = e.sizes.find((x) => x.size === '54')!;
    expect([s.stack, s.reach]).toEqual([554, 384]);
    expect(cannondale.accept(url + '?sku=x')).toEqual({ url, family: 'supersix-evo/supersix-evo-carbon-disc-105' });
    expect(cannondale.accept('https://www.cannondale.com/en-us/bikes/road/race/caad14/caad14-frameset')).toBeNull();
    expect(cannondale.accept('https://www.cannondale.com/en-us/bikes/road/endurance/synapse-carbon/synapse-neo-1')).toBeNull();
  });
  it('liv', () => {
    check(liv, 'liv', 'https://www.liv-cycling.com/us/avail-3-2022', 'Avail', ['XS', 'S', 'M', 'L'], ['XS', 530, 372]);
    expect(liv.accept('https://www.liv-cycling.com/us/avail-ar-3-2020?partnumber=1'))
      .toEqual({ url: 'https://www.liv-cycling.com/us/avail-ar-3-2020', family: 'avail-ar' });
    expect(liv.accept('https://www.liv-cycling.com/us/avail-e-plus-2')).toBeNull();
    expect(liv.accept('https://www.liv-cycling.com/us/avail-1-2015')).toBeNull();
  });
  it('factor', () => {
    check(factor, 'factor', 'https://factorbikes.com/bikes/ostro-vam', 'Ostro VAM', ['45', '49', '52', '54', '56', '58', '61'], ['54', 542, 384]);
    expect(factor.accept('https://factorbikes.com/products/o2-vam-road-bike/?x=1'))
      .toEqual({ url: 'https://factorbikes.com/products/o2-vam-road-bike/', family: 'o2-vam' });
    expect(factor.accept('https://factorbikes.com/models/vam/')?.family).toBe('o2-vam');
    expect(factor.accept('https://factorbikes.com/bikes/hanzo')).toBeNull();
    expect(factor.accept('https://factorbikes.com/bikes/ostro-vam-l39ion-edition')).toBeNull();
  });
  it('wilier', () => {
    check(wilier, 'wilier', 'https://wilier.com/en/my2022/int/racing-bikes/gravel-bikes/rave-slr', 'Rave SLR',
      ['XS', 'S', 'M', 'L', 'XL', 'XXL'], ['M', 551, 384]);
    expect(wilier.accept('https://www.wilier.com/en/bikes/road/verticale-slr-my2026')?.family).toBe('verticale-slr');
    expect(wilier.accept('https://www.wilier.com/en/bikes/road/filante-hybrid')).toBeNull();
    expect(wilier.accept('https://www.wilier.com/en/bikes/road/turbine')).toBeNull();
  });
  it('focus', () => {
    check(focus, 'focus', 'https://www.focus-bikes.com/gb_en/95606-izalco-max-disc-9-8', 'Izalco Max Disc',
      ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'], ['M', 544, 390]);
    expect(focus.accept('https://www.focus-bikes.com/gb_en/95606-izalco-max-disc-9-8.html?x=1'))
      .toEqual({ url: 'https://www.focus-bikes.com/gb_en/95606-izalco-max-disc-9-8', family: 'izalco-max-disc-9-8' });
    expect(focus.accept('https://www.focus-bikes.com/de_de/atlas-8-9')).toBeNull();
    expect(focus.accept('https://www.focus-bikes.com/int/paralane2-9-9')).toBeNull();
    expect(focus.accept('https://www.focus-bikes.com/gb_en/izalco-max-tour-test-2019')).toBeNull();
  });
  it('argon 18', () => {
    check(argon18, 'argon-18', 'https://www.argon18.com/en-us/bikes/all-road/krypton-pro/shimano-ultegra-di2', 'Krypton Pro',
      ['XXS', 'XS', 'S', 'M', 'L', 'XL'], ['M', 584, 386]);
    expect(argon18.accept('https://www.argon18.com/en-us/bikes/road/sum-pro/shimano-ultegra-di2?x=1'))
      .toEqual({ url: 'https://www.argon18.com/en-us/bikes/road/sum-pro/shimano-ultegra-di2', family: 'sum-pro' });
    expect(argon18.accept('https://www.argon18.com/en-us/bikes/triathlon/e-119-tri-disc')).toBeNull();
    expect(argon18.accept('https://www.argon18.com/en/bikes/road/performance')).toBeNull();
  });
});
