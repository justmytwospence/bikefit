import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import felt from './felt';

const html = (file: string) => readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8');
const page = (file: string, url: string, body = html(file)) => ({ url, timestamp: '20260101000000', related: {}, html: body });

const VR = 'https://www.feltbicycles.com/en-us/bikes/road-bikes/vr-endurance-road/vr-race-105.html';
const FR1 = 'https://www.feltbicycles.com/usa/2016/bikes/road/race/fr/fr1-2018.aspx';
const FR30 = 'https://www.feltbicycles.com/en-us/archive/2023/road-bikes/fr-road-race/fr-30.html';

describe('felt', () => {
  it('reads the data-bikedata JSON of the 2023-2026 site', () => {
    const [e] = felt.extract(page('felt', VR));
    expect(e.model).toBe('VR');
    expect(e.category).toBe('endurance');
    // Live pages state no model year; the build dates them from the capture.
    expect(e.year).toBeUndefined();
    // Each colour repeats the sizes: one entry per size, labelled by the frame size in cm.
    expect(e.sizes.map((s) => s.size)).toEqual(['43', '47', '51', '54', '56', '58', '61']);
    const s = e.sizes.find((x) => x.size === '54')!;
    // The page says 575.7 and 378 mm.
    expect([s.stack, s.reach]).toEqual([576, 378]);
    for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
  });

  it('reads the table of the 2018 site', () => {
    const [e] = felt.extract(page('felt-2018', FR1));
    expect(e.model).toBe('FR');
    expect(e.category).toBe('race');
    expect(e.year).toBeUndefined();
    expect(e.sizes.map((s) => s.size)).toEqual(['47', '51', '54', '56', '58', '61']);
    const s = e.sizes.find((x) => x.size === '54')!;
    expect([s.stack, s.reach]).toEqual([550, 385]);
    // The dashes of 'Seat Tube Center to Center' do not hide the seat tube length.
    expect(s.seatTubeLength).toBe(505);
    for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
  });

  it('dates an archived model by its path and names the aluminium frame', () => {
    const [e] = felt.extract(page('felt-archive', FR30));
    expect(e.model).toBe('FR Alloy');
    expect(e.year).toBe(2023);
    expect(e.sizes.map((s) => s.size)).toEqual(['43', '47', '51', '54', '56', '58', '61']);
    const s = e.sizes.find((x) => x.size === '54')!;
    expect([s.stack, s.reach]).toEqual([550, 385]);
    for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
  });

  it('drops a size whose stack does not grow (a typo on the 2018 FR2 page)', () => {
    const typo = html('felt-2018').replace('<td>Stack</td><td>512</td><td>530</td>', '<td>Stack</td><td>512</td><td>512</td>');
    const [e] = felt.extract(page('felt-2018', FR1, typo));
    expect(e.sizes.map((s) => s.size)).toEqual(['47', '54', '56', '58', '61']);
  });

  it('gives nothing for a page without geometry', () => {
    expect(felt.extract(page('felt', VR, '<html><title>VR</title><body>Geometry</body></html>'))).toEqual([]);
    expect(felt.extract(page('felt-2018', FR1, '<html><title>FR1</title><h1>FR1</h1></html>'))).toEqual([]);
    // Not a frame the adapter knows: a listing carries no table of its own.
    expect(felt.extract(page('felt-2018', 'https://www.feltbicycles.com/usa/2016/bikes/road/race.aspx'))).toEqual([]);
  });

  describe('accept', () => {
    it('takes drop-bar bike pages and gives their canonical URL and frame family', () => {
      expect(felt.accept(VR)).toEqual({ url: VR, family: 'vr-race' });
      expect(felt.accept('http://feltbicycles.com:80/USA/2016/Bikes/road/race/FR/FR1-2018.aspx')).toEqual({ url: FR1, family: 'fr' });
      expect(felt.accept('https://www.feltbicycles.com/en-us/bikes/gravel-adventurebikes/breed-carbon/breed-advanced-grx610.color.656265.html?x=1')).toEqual({
        url: 'https://www.feltbicycles.com/en-us/bikes/gravel-adventurebikes/breed-carbon/breed-advanced-grx610.html', family: 'breed-advanced',
      });
      expect(felt.accept(FR30)).toEqual({ url: FR30, family: 'fr-30-2023' });
      expect(felt.accept('https://www.feltbicycles.com/en-us/bikes/road-bikes/fr-road-race/fr-advanced-+-ultegradi2.html')?.family).toBe('fr-advanced-plus');
      expect(felt.accept('https://www.feltbicycles.com/en-us/bikes/cyclocross-bikes/fx-cyclocross-race/fx-advanced-grx-610.html')?.family).toBe('fx-advanced');
      expect(felt.accept('http://www.feltbicycles.com:80/USA/2016/Bikes/road/aero/AR3-2018.aspx')?.family).toBe('ar');
      expect(felt.accept('http://www.feltbicycles.com:80/USA/2016/Bikes/road/endurance/VR/VR60-2.aspx')?.family).toBe('vr-alloy');
      expect(felt.accept('http://www.feltbicycles.com:80/USA/2016/Bikes/road/endurance/VRW/VR2W-2018.aspx')?.family).toBe('vr-w');
      expect(felt.accept('http://www.feltbicycles.com:80/USA/2016/Bikes/cross/fx-16/F4x.aspx')?.family).toBe('fx');
    });

    it('ignores e-bikes, flat-bar, triathlon, track and mountain bikes, listings, kits and the image-only Shopify store', () => {
      for (const url of [
        'https://www.feltbicycles.com/en-us/bikes/road-bikes/verza-speed/verza-speed-40.html',
        'https://www.feltbicycles.com/en-us/bikes/triathlon-time-trialbikes/ia-triathlon-race/ia-advanced-105.html',
        'https://www.feltbicycles.com/en-us/archive/2024/triathlon-time-trialbikes/iax-triathlon-race/iax-advanced-105.html',
        'https://www.feltbicycles.com/en-us/bikes/track-bikes/tk-frd-track/tk-frd-ultimate-frame.html',
        'https://www.feltbicycles.com/en-us/bikes/road-bikes/fr-road-race.html',
        'https://www.feltbicycles.com/en-us/bikes/road-bikes.html',
        'https://www.feltbicycles.com/en-us/bikes/gravel-adventurebikes/1003293865/breed-30.html',
        'https://www.feltbicycles.com/en-us/parts/saddles/x.html',
        'https://www.feltbicycles.com/en-ca/bikes/road-bikes/vr-endurance-road/vr-race-105.html',
        'http://www.feltbicycles.com:80/USA/2016/Bikes/fitness/Verza-Speed/Verza-Speed-40-2018.aspx',
        'http://www.feltbicycles.com:80/USA/2016/Bikes/electric/road/Sport-E-85-HP.aspx',
        'http://www.feltbicycles.com:80/USA/2016/Bikes/mountain/Trail-27-5-/decree-frd.aspx',
        'http://www.feltbicycles.com:80/USA/2016/Bikes/road/race/FR/FR1-Disc-Frame-Kit.aspx',
        'http://www.feltbicycles.com:80/USA/2016/Bikes/road/aero/Frameset-AR-FRD-2.aspx',
        'http://www.feltbicycles.com:80/USA/2016/Bikes/road/race.aspx',
        'http://www.feltbicycles.com:80/USA/2016/Bikes/Living-Line-Previous-Bikes/Road/Z/z100.aspx',
        'http://www.feltbicycles.com:80/USA/2016/Bikes/TT-TRI/da-series/DA1-Frame-Kit.aspx',
        'https://feltbicycles.com/products/fr-advanced-ultegra-2020',
        'https://feltbicycles.com/products/new-breed-pro-sram-force-xplor',
      ]) expect(felt.accept(url), url).toBeNull();
    });
  });
});
