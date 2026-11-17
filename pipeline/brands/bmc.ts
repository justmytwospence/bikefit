import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Three site generations, all with an HTML geometry table: root-level and /models/ pages (2019-21), Magento
// store pages /intl_en/ etc. (2021-23) and Shopify /products/ (2024 on).
const LINE = /^(teammachine|roadmachine|kaius|urs|timemachine-(?:01-)?road|crossmachine)/;
const SKIP = /amp|topcone|speedmachine|trackmachine|fourstroke|apparel|shirt|jersey|spare|accessor|part|cover|headset|seatpost|hanger|adapter|seal|protector|stopper|chainguide|mount|clamp|expander|recall|experience/;
const BUILD = /^(one|two|three|four|five|six|seven|ltd|mod|frs|frameset|module|team|edition|\d{6})$/;
const STOP = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'ltd', 'mod', 'frs', 'frameset', 'module', 'team', 'edition',
  'carbon', 'lightweight', 'endurance', 'gravel', 'road', 'bike', 'bikes']);

/** Model line from a URL slug, used as the discover family. */
function lineKey(slug: string): string {
  const parts = slug.replace(/^(bmc-|\d\d-)/, '').replace(/([a-z])(0\d)\b/g, '$1-$2').split('-');
  const out: string[] = [];
  for (const p of parts) {
    if (/^(\d{4,}|1[89]|2\d)$/.test(p) || (out.length && STOP.has(p) && !(p === 'road' && out[0] === 'timemachine'))) break;
    out.push(p);
  }
  return out.join('-');
}

// Tiers of one frame (SLR 01/02, Roadmachine 01/plain, URS/URS LT) share their geometry and so one name.
const MODELS: [RegExp, string | null, FrameCategory][] = [
  [/\bamp\b/, null, 'race'],
  [/teammachine slr 03/, 'Teammachine SLR 03', 'race'],
  [/teammachine slr\b/, 'Teammachine SLR', 'race'],
  [/teammachine r\b/, 'Teammachine R', 'race'],
  [/teammachine alr/, 'Teammachine ALR', 'race'],
  [/roadmachine (al x|x al)\b/, 'Roadmachine AL X', 'gravel'],
  [/roadmachine (01 )?x\b/, 'Roadmachine X', 'gravel'],
  [/roadmachine\b/, 'Roadmachine', 'endurance'],
  [/kaius/, 'Kaius', 'gravel'],
  [/urs al\b/, 'URS AL', 'gravel'],
  [/^urs\b/, 'URS', 'gravel'],
  [/timemachine (road|01 road)/, 'Timemachine Road', 'aero'],
  [/crossmachine/, 'Crossmachine CX01', 'cyclocross'],
];

const adapter: Adapter = {
  brand: 'BMC',
  file: 'bmc',
  prefixes: [
    'bmc-switzerland.com/products/',
    'www.bmc-switzerland.com/intl_en/', 'www.bmc-switzerland.com/us_en/', 'www.bmc-switzerland.com/eu_en/',
    'www.bmc-switzerland.com/models/road/', 'www.bmc-switzerland.com/models/gravel/',
    'www.bmc-switzerland.com/teammachine', 'www.bmc-switzerland.com/roadmachine', 'www.bmc-switzerland.com/urs',
    'www.bmc-switzerland.com/timemachine-', 'www.bmc-switzerland.com/crossmachine', 'www.bmc-switzerland.com/2',
  ],
  seeds: [],
  accept(url) {
    const path = url.replace(/[?#].*$/, '').replace(/^https?:\/\/(?:www\.)?bmc-switzerland\.com\//i, '/');
    if (!path.startsWith('/')) return null;
    let m = path.match(/^\/products\/(([a-z0-9-]+?)-(?:[a-z-]+-)?(?:bikes|bike-frames|frames)-bmc-[0-9a-z-]+)$/);
    if (m) {
      if (!LINE.test(m[2]) || SKIP.test(m[1])) return null;
      return { url: `https://bmc-switzerland.com/products/${m[1]}`, family: `${lineKey(m[1])}@shop` };
    }
    m = path.match(/^\/((?:intl|us|eu)_en\/|models\/(?:road|gravel)\/[a-z0-9-]+\/)?([a-z0-9-]+)\.html$/);
    if (!m) return null;
    const slug = m[2].replace(/^(bmc-|\d\d-)/, '');
    if (!LINE.test(slug) || SKIP.test(slug) || !slug.split('-').some((p) => BUILD.test(p))) return null;
    const era = m[1]?.endsWith('_en/') ? 'store' : 'old';
    return { url: `https://www.bmc-switzerland.com${path}`, family: `${lineKey(m[2])}@${era}` };
  },
  extract(page) {
    // Shopify pages list every possible row, most of them empty (an empty 'Chainstay' precedes 'Rear Center').
    const $ = cheerio.load(page.html);
    $('tr').each((_, tr) => {
      const cells = $(tr).children('td,th').slice(1).map((__, c) => $(c).text().trim()).get();
      if (cells.every((c) => !c || /^n\/a$/i.test(c))) $(tr).remove();
    });
    const tables = geometryTables($.html());
    if (!tables.length) return [];
    const title = ($('h1').first().text().trim() || $('title').first().text().trim())
      .toLowerCase().replace(/\b(slr|alr|cx)(0\d)\b/g, '$1 $2').replace(/[^a-z0-9]+/g, ' ').replace(/^(bmc )?(20\d\d )?/, '').trim();
    const hit = MODELS.find(([re]) => re.test(title));
    if (!hit || !hit[1]) return [];
    return [{ model: hit[1], category: hit[2], sizes: tables.sort((a, b) => b.length - a.length)[0] }];
  },
};
export default adapter;
