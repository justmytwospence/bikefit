import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { familyName, geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Model-year pages, MY2018 to MY2022: /<year>/<slug>.cfm (2018 to 2023), and the same template under /archive/<year>/
// (2020 to 2022). Older years are out of the catalog's range.
const OLD = /^https?:\/\/(?:www\.)?konaworld\.com(?::80)?\/((?:archive\/)?(20(?:1[89]|2[0-2])))\/([a-z0-9_]+)\.cfm\/?(?:[?#].*)?$/;
// The Shopify store, from 2023: /products/<handle>.
const SHOP = /^https?:\/\/(?:www\.)?konaworld\.com(?::80)?\/products\/([a-z0-9-]+)\/?(?:[?#].*)?$/;
// Drop-bar lines: Jake (cyclocross), Rove, Sutra, Libre and Ouroboros (gravel).
const LINES = /^(?:(?:major|super)[_-])?jake|^rove|^sutra|^libre|^ouroboros/;
// Libre EL and Rove HD are e-bikes; platform pages are series overviews.
const NOT_BIKES = /(?:^|[_-])(?:el|hd)(?:[_-]|$)|platform/;
// Shopify handle suffixes: a duplicate counter (-1), colour and build codes (-gy, -ms, -sh), and two-digit codes that
// start a new range (-36sh, -b37: the 2026 Rove 37 has new geometry), which are kept as the family's era. The 650 and
// 700 of Rove AL 650 and Rove AL 700 are wheel sizes and stay.
const CODE = /-(?:b?(\d\d)[a-z]{0,3}|\d|gy|gn|bl\d|ms|sh|sr|fa)$/;

/** Kona's abbreviated row labels, as labels.ts names them. */
const RENAME: Record<string, string> = {
  'st length': 'seat tube length', 'st angle': 'seat tube angle', 'ht length': 'head tube length',
  'ht angle': 'head tube angle', 'cs length': 'chainstay length',
};

const adapter: Adapter = {
  brand: 'Kona',
  file: 'kona',
  prefixes: [
    'konaworld.com/products/', 'konaworld.com/archive/', 'konaworld.com/2018/', 'konaworld.com/2019/', 'konaworld.com/2020/',
    'konaworld.com/2021/', 'konaworld.com/2022/',
  ],
  seeds: [],
  accept(url) {
    const old = url.match(OLD);
    if (old) {
      const slug = old[3];
      if (!LINES.test(slug) || NOT_BIKES.test(slug)) return null;
      // One family per frame and model year: the /archive/ copy of a year and the DL build join the frame's page.
      const frame = slug.replace(/_/g, '-').replace(/-dl(?=-|$)|-frame$/g, '');
      return { url: `https://konaworld.com/${old[1]}/${slug}.cfm`, family: `${frame}@${old[2]}` };
    }
    const shop = url.match(SHOP);
    if (!shop) return null;
    const handle = shop[1];
    if (!LINES.test(handle) || NOT_BIKES.test(handle)) return null;
    // Frame-only pages and the DL build carry their frame's geometry; -g2 marks a new frame and stays.
    let family = handle.replace(/-(?:frame|dl)(?=-|$)/g, '').replace(/^ouroboros-supreme/, 'ouroboros-cr');
    let era = '';
    for (let m = family.match(CODE); m; m = family.match(CODE)) {
      era ||= m[1] ?? '';
      family = family.slice(0, m.index);
    }
    return { url: `https://konaworld.com/products/${handle}`, family: era ? `${family}@${era}` : family };
  },
  /** Product pages of mid-2023 frame the geometry from this host instead of carrying it. */
  related(html) {
    const src = html.match(/<iframe[^>]+src="(https?:\/\/kro\.konaworld\.com\/[^"]+\/geo\.cfm\?content=[^"]+)"/)?.[1];
    return src ? [src.replace(/^http:/, 'https:').replace(/&amp;/g, '&')] : [];
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    const title = $('h1').first().text().replace(/\s+/g, ' ').trim();
    if (!title || /\b(?:EL|HD)\b/.test(title)) return [];
    const tables = [page.html, ...Object.values(page.related)].flatMap((html) => {
      const $$ = cheerio.load(html);
      // Each row leads with the drawing's number; a second copy of the table is in inches.
      $$('#geo_inch').remove();
      $$('td.geo_numbers').remove();
      $$('td.label').each((_, td) => {
        const label = $$(td).text().replace(/\s+/g, ' ').trim().toLowerCase();
        if (RENAME[label]) $$(td).text(RENAME[label]);
      });
      return geometryTables($$.html());
    });
    if (!tables.length) return [];
    // DL (deluxe) is a build: Rove DL and Libre CR/DL list their frame's geometry. So is the Ouroboros Supreme, on the
    // carbon frame (its 2024 geometry is the Ouroboros CR's), not the aluminium Ouroboros of 2025.
    const name = title.replace(/\s*\/\s*DL\b|\s+DL\b/i, '').replace(/^Ouroboros Supreme\b/i, 'Ouroboros CR');
    const model = familyName(name, ['frame']);
    // The archive's title states the model year (KONA BIKES 2021 | DROP BAR / GRAVEL | ROVE | Rove); the model-year
    // site's path does (/2018/rove_dl.cfm). Store pages state none.
    const year = Number($('title').text().match(/KONA BIKES (20\d\d)\b/)?.[1] ?? page.url.match(OLD)?.[2]) || undefined;
    const category = categoryFrom(model, [[/jake/i, 'cyclocross']], 'gravel');
    return [{ model, year, category, sizes: tables.sort((a, b) => b.length - a.length)[0] }];
  },
};
export default adapter;
