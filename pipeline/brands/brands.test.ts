import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import canyon from './canyon';
import giant from './giant';
import specialized from './specialized';
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
  it('giant', () => check(giant, 'giant', 'https://www.giant-bicycles.com/us/tcr-advanced-pro-1-di2-2025', 'TCR Advanced', ['XS', 'S', 'M', 'ML', 'L', 'XL'], ['XS', 517, 376]));
  it('accepts and rejects urls', () => {
    expect(specialized.accept('https://www.specialized.com/us/en/turbo-creo-sl/p/1')).toBeNull();
    expect(specialized.accept('https://www.specialized.com/us/en/s-works-tarmac-sl9-sram-red/p/22?x=1')?.family).toBe('tarmac-sl9');
    expect(canyon.accept('https://www.canyon.com/en-us/road-bikes/race-bikes/ultimate/cf-slx/ultimate-cf-slx-8-di2/4372.html?a=1')?.url)
      .toBe('https://www.canyon.com/en-us/road-bikes/race-bikes/ultimate/cf-slx/ultimate-cf-slx-8-di2/4372.html');
    expect(giant.accept('https://www.giant-bicycles.com/us/tcr-advanced-pro-1-di2-2025')?.family).toBe('tcr-advanced');
    expect(giant.accept('https://www.giant-bicycles.com/us/talon-3-2025')).toBeNull();
  });
});
