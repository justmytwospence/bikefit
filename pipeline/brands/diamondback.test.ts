import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import diamondback from './diamondback';

const page = (file: string, url: string) => ({
  url, timestamp: '20260101000000', related: {}, html: readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8'),
});

function check(file: string, url: string, model: string, sizes: string[], one: [string, number, number]) {
  const [e] = diamondback.extract(page(file, url));
  expect(e.model).toBe(model);
  expect(e.sizes.map((s) => s.size)).toEqual(sizes);
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
  return e;
}

describe('diamondback', () => {
  it('reads the 2020 to 2025 geometry table', () => {
    // Haanjo 5 @20241013234554: 'Bike Stack' and 'Bike Reach' rows, sizes 'SM/50 5'4"-5'8"'.
    const e = check('diamondback', 'https://www.diamondback.com/haanjo-5-5078', 'Haanjo 5', ['47', '50', '53', '56', '60'], ['50', 581, 379]);
    expect([e.year, e.category]).toEqual([undefined, 'gravel']);
    expect(e.sizes.find((s) => s.size === '50')).toMatchObject({
      seatTubeAngle: 75, headTubeAngle: 70, headTubeLength: 130, seatTubeLength: 450, chainstay: 435, wheelbase: 1045, bbDrop: 75,
    });
  });

  it('reads the 2018 to 2019 sizes tab and the model year in the heading', () => {
    // Haanjo 7C Carbon (2018) @20191023052713: sizes '50CM 5'4"-5'7"'.
    const e = check('diamondback-legacy', 'https://www.diamondback.com/haanjo-7c-carbon-d41', 'Haanjo Carbon', ['50', '53', '56', '59'], ['56', 593, 373]);
    expect([e.year, e.category]).toEqual([2018, 'gravel']);
  });

  it('names carbon builds by line and alloy builds by number', () => {
    const p = page('diamondback-legacy', 'https://www.diamondback.com/x');
    const named = (h1: string) => diamondback.extract({ ...p, html: p.html.replace(/<h1>[^<]*/, `<h1>${h1}`) })[0];
    expect(named('Century 5C Carbon')).toMatchObject({ model: 'Century Carbon', category: 'endurance', year: undefined });
    expect(named('Arden 4 Carbon (2018)')).toMatchObject({ model: 'Arden Carbon', year: 2018 });
    expect(named('Haanjo 5C EXP Carbon').model).toBe('Haanjo Carbon');
    expect(named('Haanjo 4 EXP').model).toBe('Haanjo 4 EXP');
    expect(named('Haanjenn 3').model).toBe('Haanjenn 3');
    expect(named('Century 2').category).toBe('endurance');
  });

  it('skips flat-bar builds', () => {
    const p = page('diamondback', 'https://www.diamondback.com/haanjo-1-4669');
    const html = p.html.replace(/HED, 7050 Aluminum 12 Degree Flare, 31.8mm Bar Bore/, 'DB Flat Bar, 640mm Wide, 31.8mm Bar Bore');
    expect(html).not.toBe(p.html);
    expect(diamondback.extract({ ...p, html })).toEqual([]);
    expect(diamondback.extract({ ...p, html: '<html><h1>Haanjo 5</h1></html>' })).toEqual([]);
  });

  it('accepts and rejects urls', () => {
    expect(diamondback.accept('https://www.diamondback.com/haanjo-5-5078?___store=default'))
      .toEqual({ url: 'https://www.diamondback.com/haanjo-5-5078', family: 'haanjo-5-5078' });
    expect(diamondback.accept('http://www.diamondback.com:80/century-5c-carbon-d42'))
      .toEqual({ url: 'https://www.diamondback.com/century-5c-carbon-d42', family: 'century-5c-carbon-d42' });
    expect(diamondback.accept('https://www.diamondback.com/bikes/road-gravel-bikes/adventure-gravel/haanjo-7c-carbon-4484')?.family)
      .toBe('haanjo-7c-carbon-4484');
    expect(diamondback.accept('https://www.diamondback.com/arden5carbon-d42')?.family).toBe('arden5carbon-d42');
    expect(diamondback.accept('https://www.diamondback.com/century-elite-road-cycling-shoe')).toBeNull();
    expect(diamondback.accept('https://www.diamondback.com/haanjo-1-4669')).toBeNull();
    expect(diamondback.accept('https://www.diamondback.com/bikes/road-gravel-bikes/ebike/union-1-4664')).toBeNull();
    expect(diamondback.accept('https://www.diamondback.com/bikes/road-gravel-bikes/adventure-gravel')).toBeNull();
    expect(diamondback.accept('https://www.diamondback.com/products/haanjo-5')).toBeNull();
  });
});
