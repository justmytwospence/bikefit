import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { geometryTables } from '../lib/extract';
import { keyFor } from '../lib/labels';
import type { Adapter, PartialSize } from '../types';

// Product slug (after the article number) to model name and category; first match wins.
// Series 5 and 6 (and the older '-al-' names) are aluminium, 8 and 9 carbon: Focus's own names say 'AL'.
const LINES: [RegExp, string, FrameCategory][] = [
  [/^izalco-max-disc-/, 'Izalco Max Disc', 'race'],
  [/^izalco-max-/, 'Izalco Max', 'race'],
  [/^izalco-race-(?:al-|[56]-)/, 'Izalco Race AL', 'race'],
  [/^izalco-race-disc-/, 'Izalco Race Disc', 'race'],
  [/^izalco-race-/, 'Izalco Race', 'race'],
  [/^paralane-(?:al-|[56]-)/, 'Paralane AL', 'endurance'],
  [/^paralane-/, 'Paralane', 'endurance'],
  [/^mares-(?:al-|[56]-)/, 'Mares AL', 'cyclocross'],
  [/^mares-/, 'Mares', 'cyclocross'],
  [/^atlas-(?:al-|[56]-?\d)/, 'Atlas AL', 'gravel'],
  [/^atlas-/, 'Atlas', 'gravel'],
];

// Product pages: /<locale>/<article number>-<slug> until 2023, /<locale>/<slug> since.
// English locales only: the label words are English (the German and French stores translate them).
const URL_RE = /^https?:\/\/www\.focus-bikes\.com(?::80)?\/([a-z]{2}_en|int)\/(?:(\d+)-)?([a-z0-9-]+?)(?:\.html)?\/?(?:[?#&].*)?$/;
const LOCALES = [
  'gb_en', 'us_en', 'int', 'de_en', 'at_en', 'au_en', 'be_en', 'ch_en', 'es_en', 'fr_en', 'it_en', 'nl_en', 'nz_en',
  'cz_en', 'no_en', 'fi_en', 'se_en', 'dk_en', 'sk_en', 'pl_en', 'kr_en', 'jp_en', 'co_en',
];

// After the line's name a model page has its series and level (9-9, 87, 9-frameset) or, before 2020, its groupset
// (al-105, disc-red-etap); other pages under the same words are stories and reviews (izalco-max-tour-test-2019).
const BUILD = /^(?:disc-|al-)?(?:\d-?\d|\d-(?:frameset|fs)|frameset|fs|105|sora|tiagra|ultegra|dura-ace|red|force|rival|apex|mechanical|di2|factory|commuter|pari)(?:-|$)/;

function lineOf(slug: string): { model: string; category: FrameCategory } | null {
  // Paralane² is the e-road bike; Izalco Chrono and Ergoride are time-trial bikes.
  if (/paralane2|chrono|ergoride/.test(slug)) return null;
  const rest = slug.replace(/^(?:izalco-max|izalco-race|paralane|mares|atlas)-/, '');
  if (rest === slug || !BUILD.test(rest)) return null;
  const hit = LINES.find(([re]) => re.test(slug));
  return hit ? { model: hit[1], category: hit[2] } : null;
}

/** True when stack, reach and head tube grow with size and no two sizes repeat. Captures from about September 2021
 * fill each size's column from other bikes (an M with a 66.3 degree head angle and 1214 mm wheelbase, sizes repeated):
 * rejecting them lets discover try another capture. */
function ordered(sizes: PartialSize[]): boolean {
  const seen = new Set<string>();
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    const k = `${s.stack}/${s.reach}`;
    if (seen.has(k)) return false;
    seen.add(k);
    if (!i) continue;
    const p = sizes[i - 1];
    if (s.stack! < p.stack! || s.reach! < p.reach!) return false;
    if (s.headTubeLength !== undefined && p.headTubeLength !== undefined && s.headTubeLength < p.headTubeLength) return false;
  }
  return true;
}

const adapter: Adapter = {
  brand: 'Focus',
  file: 'focus',
  prefixes: LOCALES.map((l) => `www.focus-bikes.com/${l}/`),
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    if (!m || !lineOf(m[3])) return null;
    // One family per product slug, pooling locales and article numbers: discover then tries every product in every
    // period, so a period whose captures are all broken (September 2021) for one product is covered by another.
    // Identical geometry merges in the build.
    return { url: `https://www.focus-bikes.com/${m[1]}/${m[2] ? `${m[2]}-` : ''}${m[3]}`, family: m[3] };
  },
  extract(page) {
    const m = page.url.match(URL_RE);
    const line = m ? lineOf(m[3]) : null;
    if (!line) return [];
    const $ = cheerio.load(page.html);
    // Rows start with the drawing's letter (blank for the size and cockpit rows), then the label: drop the letter column.
    // Before 2021 row A (the seat tube) is labelled 'Size'.
    $('table.geometry tr').each((_, tr) => {
      const [letter, label] = $(tr).children('td,th').toArray();
      if ($(letter).text().trim() === 'A' && label && !keyFor($(label).text())) $(label).text('seat tube length');
      $(letter).remove();
    });
    const tables = geometryTables($.html($('table.geometry').first()));
    if (!tables.length) return [];
    const sizes = tables[0];
    if (!ordered(sizes)) return [];
    return [{ model: line.model, category: line.category, sizes }];
  },
};
export default adapter;
