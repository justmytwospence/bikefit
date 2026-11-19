import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import kona from './kona';

const fixture = (file: string) => readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8');
const page = (file: string, url: string) => ({ url, timestamp: '20260101000000', related: {}, html: fixture(file) });

function check(p: ReturnType<typeof page>, model: string, sizes: string[], one: [string, number, number]) {
  const [e] = kona.extract(p);
  expect(e.model).toBe(model);
  expect(e.sizes.map((s) => s.size)).toEqual(sizes);
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
  return e;
}

describe('kona', () => {
  it('reads the store page (2023 on)', () => {
    const e = check(page('kona', 'https://konaworld.com/products/sutra-b36'), 'Sutra', ['48', '50', '52', '54', '56', '58'], ['48', 551, 375]);
    expect([e.year, e.category]).toEqual([undefined, 'gravel']);
    const s = e.sizes[0];
    expect([s.seatTubeAngle, s.headTubeAngle, s.headTubeLength, s.seatTubeLength, s.chainstay, s.wheelbase, s.bbDrop])
      .toEqual([75, 70.5, 105, 480, 445, 1036, 74]);
  });

  it('reads the model-year page (2018 to 2022), in millimetres, dated by its path', () => {
    const url = 'https://konaworld.com/2018/rove_dl.cfm';
    const e = check(page('kona-cfm', url), 'Rove', ['48', '50', '52', '54', '56', '58'], ['48', 532, 373]);
    expect([e.year, e.category]).toEqual([2018, 'gravel']);
    const s = e.sizes[0];
    expect([s.seatTubeAngle, s.headTubeAngle, s.headTubeLength, s.seatTubeLength, s.chainstay, s.wheelbase, s.bbDrop])
      .toEqual([75, 70.5, 90, 480, 435, 1012, 74]);
    const titled = (t: string, h1: string) => kona.extract({ ...page('kona-cfm', url), html: fixture('kona-cfm').replace(/<title>[^<]*/, `<title>${t}`).replace('<h1>Rove DL</h1>', `<h1>${h1}</h1>`) })[0];
    expect(titled('KONA BIKES 2021 | DROP BAR / GRAVEL  |  JAKE  |  Major Jake', 'Major Jake')).toMatchObject({ model: 'Major Jake', year: 2021, category: 'cyclocross' });
    expect(titled('x', 'Libre CR/DL').model).toBe('Libre CR');
    expect(titled('x', 'Super Jake Frame').model).toBe('Super Jake');
    expect(titled('x', 'Ouroboros Supreme').model).toBe('Ouroboros CR');
    expect(titled('x', 'Libre EL')).toBeUndefined();
  });

  it('reads the framed geometry of mid-2023 store pages', () => {
    // The head of https://konaworld.com/products/rove at 20230610214901: the geometry is in an iframe.
    const url = 'https://konaworld.com/products/rove';
    const html = '<title>KONA Rove</title><h1 class="product-info__title h3" >Rove</h1><div id="kro_geo"><h3>GEOMETRY</h3>'
      + '<iframe src="https://kro.konaworld.com/36e/geo.cfm?content=rove"></iframe></div>';
    const geo = 'https://kro.konaworld.com/36e/geo.cfm?content=rove';
    expect(kona.related!(html, url)).toEqual([geo]);
    expect(kona.related!(fixture('kona'), 'https://konaworld.com/products/sutra-b36')).toEqual([]);
    const p = { url, timestamp: '20230610214901', html, related: {} };
    expect(kona.extract(p)).toEqual([]);
    check({ ...p, related: { [geo]: fixture('kona-kro') } }, 'Rove', ['48', '50', '52', '54', '56', '58'], ['48', 532, 372]);
  });

  it('accepts drop-bar bike pages and rejects the rest', () => {
    expect(kona.accept('https://konaworld.com/products/sutra-b36?variant=4711')).toEqual({ url: 'https://konaworld.com/products/sutra-b36', family: 'sutra@36' });
    expect(kona.accept('https://www.konaworld.com/products/rove-dl-gy?srsltid=x')?.family).toBe('rove');
    expect(kona.accept('https://konaworld.com/products/rove-al-700-36b')?.family).toBe('rove-al-700@36');
    expect(kona.accept('https://konaworld.com/products/rove-al-650-1')?.family).toBe('rove-al-650');
    expect(kona.accept('https://konaworld.com/products/libre-cr-dl-frame-g2')).toEqual({ url: 'https://konaworld.com/products/libre-cr-dl-frame-g2', family: 'libre-cr-g2' });
    expect(kona.accept('http://www.konaworld.com:80/2018/rove_dl.cfm'))
      .toEqual({ url: 'https://konaworld.com/2018/rove_dl.cfm', family: 'rove@2018' });
    expect(kona.accept('https://konaworld.com/archive/2021/libre_cr_dl.cfm'))
      .toEqual({ url: 'https://konaworld.com/archive/2021/libre_cr_dl.cfm', family: 'libre-cr@2021' });
    expect(kona.accept('https://konaworld.com/products/libre-el')).toBeNull();
    expect(kona.accept('https://konaworld.com/products/rove-hd')).toBeNull();
    expect(kona.accept('https://konaworld.com/archive/2021/platform_jake.cfm')).toBeNull();
    expect(kona.accept('https://konaworld.com/archive/2017/rove_st.cfm')).toBeNull();
    expect(kona.accept('https://konaworld.com/products/lbf')).toBeNull();
    expect(kona.accept('https://konaworld.com/products/dew')).toBeNull();
  });
});
