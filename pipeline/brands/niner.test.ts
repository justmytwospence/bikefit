import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import niner from './niner';
import type { Adapter } from '../types';

const page = (file: string, url: string) => ({
  url, timestamp: '20260101000000', related: {}, html: readFileSync(join(__dirname, '..', 'fixtures', `${file}.html`), 'utf8'),
});

function check(a: Adapter, file: string, url: string, model: string, sizes: string[], one: [string, number, number]) {
  const found = a.extract(page(file, url));
  expect(found).toHaveLength(1);
  const [e] = found;
  expect(e.model).toBe(model);
  expect(e.category).toBe('gravel');
  expect(e.year).toBeUndefined();
  expect(e.sizes.map((s) => s.size).sort()).toEqual([...sizes].sort());
  const s = e.sizes.find((x) => x.size === one[0])!;
  expect([s.stack, s.reach]).toEqual([one[1], one[2]]);
  for (const x of e.sizes) for (const k of ['seatTubeAngle', 'headTubeAngle', 'wheelbase'] as const) expect(x[k]).toBeGreaterThan(0);
}

const SIZES = ['47cm', '50cm', '53cm', '56cm', '59cm', '62cm'];

describe('niner', () => {
  it('reads the RLT 9 RDO frame page', () => {
    check(niner, 'niner', 'https://www.ninerbikes.com/rlt-9-rdo-frame/', 'RLT 9 RDO', SIZES, ['47cm', 535, 362]);
    const [e] = niner.extract(page('niner', 'https://www.ninerbikes.com/rlt-9-rdo-frame/'));
    // The metric block only: the imperial rows repeat the sizes in inches.
    expect(e.sizes).toHaveLength(6);
    expect(e.sizes[0]).toEqual({
      size: '47cm', seatTubeLength: 430, chainstay: 430, wheelbase: 1000, bbDrop: 75, headTubeLength: 105, headTubeAngle: 70, seatTubeAngle: 74.5,
      reach: 362, stack: 535,
    });
    expect(e.sizes[5]).toMatchObject({ size: '62cm', stack: 634, reach: 405, headTubeAngle: 72.5, seatTubeAngle: 72.5, wheelbase: 1054 });
  });
  it('reads the ORE 9 RDO frameset page', () => {
    check(niner, 'niner-2025', 'https://www.ninerbikes.com/ore-9-rdo-frameset/', 'ORE 9 RDO', SIZES, ['50cm', 560, 395]);
  });
  it('keeps the 9 in RLT 9', () => {
    check(niner, 'niner-2024', 'https://www.ninerbikes.com/rlt-9-frameset-1/', 'RLT 9', SIZES, ['56cm', 594, 383]);
  });
  it('names the frame of a build page whose title has no dash', () => {
    const p = page('niner-2024', 'https://www.ninerbikes.com/rlt-9-apex-xplr/');
    const [e] = niner.extract({ ...p, html: p.html.replace('<title>RLT 9 - FRAMESET</title>', '<title>RLT 9 APEX XPLR</title>') });
    expect(e.model).toBe('RLT 9');
    const q = page('niner', 'https://www.ninerbikes.com/rlt-9-rdo-sram-apex-xplr/');
    expect(niner.extract({ ...q, html: q.html.replace('<title>RLT 9 RDO - FRAMESET</title>', '<title>RLT 9 RDO APEX XPLR</title>') })[0].model).toBe('RLT 9 RDO');
    expect(niner.extract({ ...q, html: q.html.replace('<title>RLT 9 RDO - FRAMESET</title>', '<title>RLT E9 RDO - FRAMESET</title>') })).toEqual([]);
  });
  it('has nothing to read on a page without the table', () => {
    expect(niner.extract({ url: 'https://www.ninerbikes.com/rlt-9-rdo/', timestamp: '20230322000000', related: {}, html: '<html><head><title>RLT 9 RDO</title></head><body><img src="/media/rlt-9-rdo-geo-chart.jpg"></body></html>' })).toEqual([]);
  });
  describe('accept', () => {
    it('takes frame and build pages and groups them by frame', () => {
      expect(niner.accept('https://www.ninerbikes.com/rlt-9-rdo-frame/')).toEqual({ url: 'https://www.ninerbikes.com/rlt-9-rdo-frame/', family: 'rlt-9-rdo' });
      expect(niner.accept('http://www.ninerbikes.com:80/rlt-9-steel-frame/?___store=niner_store_view')).toEqual({ url: 'https://www.ninerbikes.com/rlt-9-steel-frame/', family: 'rlt-9-steel' });
      expect(niner.accept('https://www.ninerbikes.com/rlt-9-frameset-1/')).toEqual({ url: 'https://www.ninerbikes.com/rlt-9-frameset-1/', family: 'rlt-9' });
      expect(niner.accept('https://www.ninerbikes.com/ore-9-rdo-2-star-apex-1-xplr-12sp/')).toEqual({ url: 'https://www.ninerbikes.com/ore-9-rdo-2-star-apex-1-xplr-12sp/', family: 'ore-9-rdo' });
    });
    it('rejects listings, family pages, image-only eras and other bikes', () => {
      expect(niner.accept('https://www.ninerbikes.com/gravel/rlt-9-rdo/')).toBeNull();
      expect(niner.accept('https://www.ninerbikes.com/rlt-9-rdo/')).toBeNull();
      expect(niner.accept('https://www.ninerbikes.com/rlt-9-rdo-650b/')).toBeNull();
      expect(niner.accept('https://www.ninerbikes.com/rlt-e9-rdo-frame/')).toBeNull();
      expect(niner.accept('http://www.ninerbikes.com:80/RLT-9-RDO-Frameset-MY18')).toBeNull();
      expect(niner.accept('https://ninerbikes.com/products/rlt-9-rdo-my2020')).toBeNull();
      expect(niner.accept('https://www.ninerbikes.com/jet-9-rdo-frame/')).toBeNull();
    });
  });
});
