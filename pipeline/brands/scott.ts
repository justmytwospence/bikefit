import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { geometryTables } from '../lib/extract';
import { keyFor } from '../lib/labels';
import type { Adapter } from '../types';

// Product slug (after 'scott-') to model name and category; first match wins.
const LINES: [RegExp, string, FrameCategory][] = [
  [/^contessa-addict-rc-/, 'Contessa Addict RC', 'race'],
  [/^contessa-addict-gravel-/, 'Contessa Addict Gravel', 'gravel'],
  [/^contessa-addict-/, 'Contessa Addict', 'endurance'],
  [/^contessa-speedster-gravel-/, 'Contessa Speedster Gravel', 'gravel'],
  [/^contessa-speedster-/, 'Contessa Speedster', 'endurance'],
  [/^addict-rc-/, 'Addict RC', 'race'],
  [/^addict-gravel-/, 'Addict Gravel', 'gravel'],
  [/^addict-cx-/, 'Addict CX', 'cyclocross'],
  [/^addict-/, 'Addict', 'endurance'],
  [/^foil-rc-/, 'Foil RC', 'aero'],
  [/^foil-/, 'Foil', 'aero'],
  [/^speedster-gravel-/, 'Speedster Gravel', 'gravel'],
  [/^speedster-cx-/, 'Speedster CX', 'cyclocross'],
  [/^speedster-/, 'Speedster', 'endurance'],
];

const URL_RE = /^https?:\/\/www\.scott-sports\.com\/(us\/en|gb\/en|global\/en)\/product\/scott-([a-z0-9-]+?)(?:\/)?(?:[?#].*)?$/;
const LOCALES = ['us/en', 'gb/en', 'global/en'];
const PRODUCTS = ['addict', 'foil', 'speedster', 'contessa-addict', 'contessa-speedster'];

function lineOf(slug: string): { model: string; category: FrameCategory } | null {
  if (/eride|-e-|junior|kids|rigid|active/.test(slug)) return null;
  if (!/-(?:bike|frame-?set)(?:-|$)/.test(slug)) return null;
  const hit = LINES.find(([re]) => re.test(slug));
  if (!hit) return null;
  return { model: hit[1], category: hit[2] };
}

const adapter: Adapter = {
  brand: 'Scott',
  file: 'scott',
  prefixes: LOCALES.flatMap((l) => PRODUCTS.map((p) => `www.scott-sports.com/${l}/product/scott-${p}`)),
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    if (!m || !lineOf(m[2])) return null;
    // Most captures of scott-sports.com are bot-check pages, and discover keeps one capture per family and period:
    // one family per product page (and locale) gives each page its own chance of a real capture.
    return { url: `https://www.scott-sports.com/${m[1]}/product/scott-${m[2]}`, family: `${m[1].split('/')[0]}-${m[2]}` };
  },
  // Since 2022 the geometry table is loaded from a separate HTML fragment.
  related(html) {
    const u = cheerio.load(html)('[data-geometry-data-url]').attr('data-geometry-data-url');
    return u ? [u.replace(/^http:/, 'https:')] : [];
  },
  extract(page) {
    const m = page.url.match(URL_RE);
    const line = m ? lineOf(m[2]) : null;
    if (!line) return [];
    const sources = [page.html, ...Object.values(page.related)];
    for (const html of sources) {
      // Rows start with the drawing's letter, then the label: drop the letter column.
      const $ = cheerio.load(html);
      // Scott's drawing letters are fixed; G (wheel base) is sometimes labelled with the model name instead.
      $('table.geometrytable tr').each((_, tr) => {
        const [letter, label] = $(tr).children('td,th').toArray();
        if ($(letter).text().trim() === 'G' && label && !keyFor($(label).text())) $(label).text('wheel base');
        $(letter).remove();
      });
      const tables = geometryTables($.html());
      if (!tables.length) continue;
      const sizes = tables.sort((a, b) => b.length - a.length)[0].map((x) => ({ ...x, size: x.size.replace(/\s*\/\s*/, ' ') }));
      // Pages of older bikes kept on sale carry their model year in the slug (scott-addict-rc-20-bike-2021).
      const year = Number(m![2].match(/-(20[12]\d)$/)?.[1]) || undefined;
      return [{ model: line.model, year, category: line.category, sizes }];
    }
    return [];
  },
};
export default adapter;
