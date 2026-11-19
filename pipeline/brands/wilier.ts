import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Product slug to family key, model name and category; first match wins. Slugs carry build, colour and year
// suffixes (gtr-team-disc, cento10air-ramato, filante-slr-my2025, rave-slr-gravel), so match on the start.
const LINES: [RegExp, string, string, FrameCategory][] = [
  [/^(?:new-)?filante-slr-id2/, 'filante-slr-id2', 'Filante SLR ID2', 'aero'],
  [/^filante-slr/, 'filante-slr', 'Filante SLR', 'aero'],
  [/^filante-sl-id2/, 'filante-sl-id2', 'Filante SL ID2', 'aero'],
  [/^filante-sl/, 'filante-sl', 'Filante SL', 'aero'],
  [/^(?:new-)?verticale-slr/, 'verticale-slr', 'Verticale SLR', 'race'],
  // The Zero SLR's slug went from wilier-zero-slr (MY2020-MY2023) to wilier-0-slr (2023 on).
  [/^(?:wilier-)?(?:zero|0)-?slr/, 'zero-slr', 'Zero SLR', 'race'],
  [/^(?:wilier-)?(?:zero|0)-?sl(?:-|$)/, 'zero-sl', 'Zero SL', 'race'],
  [/^zero-?7/, 'zero7', 'Zero 7', 'race'],
  [/^zero-?6/, 'zero6', 'Zero 6', 'race'],
  [/^cento-?10-?air/, 'cento10air', 'Cento10 Air', 'aero'],
  [/^cento-?10-?pro/, 'cento10pro', 'Cento10 Pro', 'aero'],
  [/^cento-?10-?sl/, 'cento10sl', 'Cento10 SL', 'aero'],
  [/^cento-?10-?ndr/, 'cento10ndr', 'Cento10 NDR', 'endurance'],
  [/^cento-?1-?air/, 'cento1air', 'Cento1 Air', 'race'],
  [/^cento-?1-?ndr/, 'cento1ndr', 'Cento1 NDR', 'endurance'],
  [/^granturismo-slr/, 'granturismo-slr', 'Granturismo SLR', 'endurance'],
  [/^granturismo-sl/, 'granturismo-sl', 'Granturismo SL', 'endurance'],
  [/^gtr-team/, 'gtr-team', 'GTR Team', 'endurance'],
  [/^garda/, 'garda', 'Garda', 'endurance'],
  [/^montegrappa/, 'montegrappa', 'Montegrappa', 'endurance'],
  [/^superleggera/, 'superleggera', 'Superleggera', 'endurance'],
  [/^rapida/, 'rapida', 'Rapida', 'race'],
  [/^rave-slr-id2/, 'rave-slr-id2', 'Rave SLR ID2', 'gravel'],
  [/^rave-slr/, 'rave-slr', 'Rave SLR', 'gravel'],
  [/^rave-sl/, 'rave-sl', 'Rave SL', 'gravel'],
  [/^adlar/, 'adlar', 'Adlar', 'gravel'],
  [/^jena/, 'jena', 'Jena', 'gravel'],
  [/^jaroon/, 'jaroon', 'Jaroon', 'gravel'],
  [/^jareen/, 'jareen', 'Jareen', 'gravel'],
];
// Hybrids are e-bikes, Turbine and Supersonica TT bikes (not under road/gravel paths anyway). Luna (aluminium leisure
// road, MY2020-MY2022) is left out: its table has no reach or stack.
const REJECT = /hybrid|turbine|supersonica|-e-|^e\d|kids|junior/;

// 2018: /en/products/<market>/<type>/<slug>; MY2019-MY2024 (captured 2019 to 2023):
// /en/my2020/<market>/<range>/<type>/<slug>; late 2023 on: /en/bikes/<type>/<slug> and /en/bikes-archive/[<year>/]<slug>.
const URL_RE = new RegExp(
  '^https?://(?:www\\.)?wilier\\.com/en/(?:'
  + 'products/(?:int|world|us)/(?:road|gravel)'
  + '|my(20\\d\\d)/(?:int|world)/(?:[a-z-]+-bikes/)?(?:road|gravel)(?:-bikes)?'
  + '|bikes/(?:road|gravel)'
  + '|bikes-archive(?:/(20\\d\\d))?'
  + ')/([a-z0-9-]+)/?(?:[?#].*)?$',
);

function parse(url: string) {
  const m = url.match(URL_RE);
  if (!m) return null;
  const slug = m[3];
  if (REJECT.test(slug)) return null;
  const hit = LINES.find(([re]) => re.test(slug));
  if (!hit) return null;
  // Model year: the my20xx folder, else a -my20xx slug suffix, else the archive's year folder.
  const year = Number(m[1] ?? slug.match(/-my(20\d\d)$/)?.[1] ?? m[2]) || undefined;
  return { family: hit[1], model: hit[2], category: hit[3], year };
}

// Wilier labels geometry with the letters of its drawing; reach, stack and wheelbase are spelled out.
// H (seat tube centre to top) and L (top tube) are left unmapped.
const LETTERS: Record<string, string> = {
  'C/C': 'seat tube c c', A: 'seat tube angle', A1: 'head tube angle', H1: 'head tube length', L1: 'chainstay',
};

const adapter: Adapter = {
  brand: 'Wilier',
  file: 'wilier',
  prefixes: ['www.wilier.com/en/products/', 'www.wilier.com/en/my20', 'www.wilier.com/en/bikes'],
  seeds: [],
  accept(url) {
    const p = parse(url);
    if (!p) return null;
    return { url: url.replace(/[?#].*$/, '').replace(/\/$/, '').replace(/^http:/, 'https:'), family: p.family };
  },
  extract(page) {
    const p = parse(page.url);
    if (!p) return [];
    const $ = cheerio.load(page.html);
    $('table').each((_, t) => {
      if (!/reach/i.test($(t).text())) return;
      $(t).find('td,th').each((_, c) => {
        const code = $(c).text().replace(/\s+/g, ' ').trim().replace(/\s*[([].*$/, '').toUpperCase();
        if (LETTERS[code]) $(c).text(LETTERS[code]);
      });
    });
    const tables = geometryTables($.html());
    if (!tables.length) return [];
    const sizes = tables.sort((a, b) => b.length - a.length)[0];
    return [{ model: p.model, year: p.year, category: p.category, sizes }];
  },
};
export default adapter;
