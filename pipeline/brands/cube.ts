import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { geometryTables } from '../lib/extract';
import type { Adapter, PartialSize } from '../types';

// Two site generations: www.cube.eu/<year>/bikes/... (2019-22, German labels in div rows, angles rounded to whole
// degrees) and www.cube.eu/[uk-en/]cube-<slug>/<id> (2023 on, an HTML table).
const LINES = ['litening-aero', 'litening-air', 'litening', 'agree', 'attain', 'cross-race', 'nuroad-ws', 'nuroad', 'axial-ws'];
const SKIP = /hybrid|rookie|comfort|storage|bag|box|seatpost|stem|basebar|guard|mudguard|bracket|bladder|hydration|kit/;

/** Line plus frame material (C:62, C:68X, GTC) from a URL slug, used as the discover family. */
function family(slug: string): string | null {
  const s = slug.replace(/^cube-/, '').replace(/\bc-(\d\dx?)\b/g, 'c$1');
  const line = LINES.find((l) => s === l || s.startsWith(`${l}-`));
  if (!line || SKIP.test(s)) return null;
  const mat = s.slice(line.length + 1).split('-')[0];
  return /^(c\d\dx?|gtc)$/.test(mat) ? `${line}-${mat}` : line;
}

const WORDS = new Set(['LITENING', 'AERO', 'AIR', 'AGREE', 'ATTAIN', 'CROSS', 'NUROAD', 'AXIAL', 'WS', 'GTC']);
const CATEGORY: [RegExp, FrameCategory][] = [
  [/aero/i, 'aero'], [/litening/i, 'race'], [/agree|attain|axial/i, 'endurance'], [/cross race/i, 'cyclocross'], [/nuroad/i, 'gravel'],
];

/** 'LITENING AERO C:68X RACE' -> 'Litening Aero C:68X'. */
function modelName(title: string): string | null {
  const parts = title.toUpperCase().replace(/[´`'’]/g, '').split(/\s+/).filter(Boolean);
  if (parts[0] === 'CUBE') parts.shift();
  const out: string[] = [];
  for (const p of parts) {
    if (WORDS.has(p) || /^C:\d\dX?$/.test(p) || (p === 'RACE' && out[out.length - 1] === 'CROSS')) out.push(p);
    else break;
  }
  if (!out.length || !/LITENING|AGREE|ATTAIN|CROSS|NUROAD|AXIAL/.test(out[0])) return null;
  return out.map((w) => (/^(C:|GTC|WS)/.test(w) ? w : w[0] + w.slice(1).toLowerCase())).join(' ');
}

/** '50 cm / XS', 'XS-50cm' -> 'XS'; '50 cm' -> '50'. */
function sizeLabel(raw: string): string {
  const s = raw.replace(/\*/g, '');
  const letter = s.match(/\b(\d?X{0,3}[SL]|M)\b/i);
  return letter ? letter[1].toUpperCase() : s.replace(/\s*cm\b/i, '').trim();
}

const adapter: Adapter = {
  brand: 'Cube',
  file: 'cube',
  prefixes: [
    'www.cube.eu/cube-', 'www.cube.eu/uk-en/cube-',
    'www.cube.eu/2019/bikes/', 'www.cube.eu/2020/bikes/', 'www.cube.eu/2021/bikes/', 'www.cube.eu/2022/bikes/',
  ],
  seeds: [],
  accept(url) {
    const u = url.replace(/[?#].*$/, '').replace(/^http:/, 'https:');
    let m = u.match(/^https:\/\/www\.cube\.eu\/((?:uk-en\/)?)(cube-[a-z0-9-]+)\/(\d{6,}|[0-9a-f]{32})$/);
    if (m) {
      const f = family(m[2]);
      return f ? { url: u, family: f } : null;
    }
    m = u.match(/^https:\/\/www\.cube\.eu\/20(?:19|2[0-2])\/bikes\/(?:road|women)\/[a-z-]+\/[a-z-]+\/(cube-[a-z0-9-]+)\/?$/);
    if (!m || /triathlon|aerium/.test(u)) return null;
    const f = family(m[1].replace(/-20\d\d$/, ''));
    return f ? { url: u.endsWith('/') ? u : `${u}/`, family: `${f}@old` } : null;
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    // The old site lays the geometry out in div rows (2020-22) or in data-labels JSON per size (2019): make a table.
    let grid: string[][] = $('.geometrytable .geo-row').map((_, r) => [$(r).find('.geo-label, .geo-value').map((__, c) => $(c).text().trim()).get()]).get();
    if (!grid.length) {
      const items = $('li[data-labels]').map((_, li) => {
        try {
          return [{ size: $(li).attr('data-framesize') ?? '', v: JSON.parse($(li).attr('data-labels') ?? '') as Record<string, string> }];
        } catch {
          return [];
        }
      }).get() as { size: string; v: Record<string, string> }[];
      const info = items.find((i) => !i.size);
      const sizes = items.filter((i) => i.size);
      if (info && sizes.length) grid = [['', ...sizes.map((s) => s.size)], ...Object.entries(info.v).map(([k, label]) => [label, ...sizes.map((s) => s.v[k] ?? '')])];
    }
    if (grid.length) {
      const cell = (t: string) => `<td>${t.replace(/<br\s*\/?>/gi, ' ').replace(/[<>&]/g, ' ')}</td>`;
      $('body').append(`<table>${grid.map((r) => `<tr>${r.map(cell).join('')}</tr>`).join('')}</table>`);
    }
    $('td, th').each((_, c) => {
      if (/^\s*(BB-Height to Hub|Tretlagerh(ö|oe)he zur N[ae]benachse)\s*$/i.test($(c).text())) $(c).text('BB drop');
    });
    const tables = geometryTables($.html());
    if (!tables.length) return [];
    const title = $('h1').first().text().replace(/\s+/g, ' ').trim();
    if (/hybrid|rookie|aerium|nulane/i.test(title)) return [];
    let model = modelName(title);
    if (!model) return [];
    // Old women's pages title themselves without 'WS'.
    if (/-ws(-|\/|$)/.test(page.url) && !/ WS\b/.test(model)) model = model.replace(/^(\S+)/, '$1 WS');
    const category = CATEGORY.find(([re]) => re.test(model))?.[1] ?? 'race';
    const sizes: PartialSize[] = tables[0].map((s) => ({ ...s, size: sizeLabel(s.size) }));
    return [{ model, category, sizes }];
  },
};
export default adapter;
