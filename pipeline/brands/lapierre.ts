import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Only the Shopify store (en-int, captured from May to August 2026) shows geometry as text: a table of every size with
// all nine measurements. The Gatsby site before it (www.lapierrebikes.com/<locale>/o/<name>-<year>/, 2021 to early 2026)
// shows a chart image, or renders it in the browser, so those pages are not asked for and discovery stays small.
// The other locales (en-gb, de-de, ...) list the same products again.
const URL_RE = /^https?:\/\/(?:www\.)?lapierrebikes\.com\/en-int\/products\/((?:xelius-drs|aerostorm-drs|pulsium|sensium|crosshill(?:-cf)?)-[a-z0-9-]+)\/?(?:[?#].*)?$/;

// Flat-bar and electric variants of these lines have their own slugs; kept out in case one turns up under a drop-bar name.
const NOT_DROP_BAR = /(?:^|-)(?:e|ebike|electric|flat|junior|kids|kid)(?:-|$)/;

/** The drop-bar frames: the slug or title that names them, and the model the catalog lists. */
const FRAMES: [RegExp, string, string][] = [
  [/^xelius[ -]drs\b/, 'xelius-drs', 'Xelius DRS'],
  [/^aerostorm[ -]drs\b/, 'aerostorm-drs', 'Aerostorm DRS'],
  [/^pulsium\b/, 'pulsium', 'Pulsium'],
  [/^sensium\b/, 'sensium', 'Sensium'],
  [/^crosshill[ -]cf\b/, 'crosshill-cf', 'Crosshill CF'],
  // The aluminium Crosshill (2.0 to 4.0): the carbon one has its own geometry and is Crosshill CF.
  [/^crosshill\b/, 'crosshill', 'Crosshill AL'],
];

const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const adapter: Adapter = {
  brand: 'Lapierre',
  file: 'lapierre',
  prefixes: ['lapierrebikes.com/en-int/products/'],
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    if (!m || NOT_DROP_BAR.test(m[1])) return null;
    const frame = FRAMES.find(([re]) => re.test(m[1]));
    if (!frame) return null;
    return { url: `https://lapierrebikes.com/en-int/products/${m[1]}`, family: frame[1] };
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    // Each row leads with the drawing's letter ('A: Seat tube length (mm)', 'D: Head Tube Angle'): drop it.
    $('tr').each((_, tr) => {
      const first = $(tr).children('td,th').first();
      first.text(first.text().replace(/^\s*[A-Z]\d?\s*:\s*/, ''));
    });
    // The page's other tables (the compare drawer) carry no geometry; read the geometry section's own table first.
    const scope = $('.geometrie_dimension_table');
    const tables = geometryTables(scope.length ? scope.map((_, el) => $.html(el)).get().join('\n') : $.html());
    if (!tables.length) return [];
    // The product title is a build ('xelius DRS 8.0', 'Aérostorm drs', 'Sensium 3.0 Disc'): name the frame by its line.
    // The slug of a product page names it too.
    const title = $('h1').first().text() || $('title').first().text();
    const slug = page.url.match(/\/products\/([a-z0-9-]+)/)?.[1] ?? '';
    const name = plain(title);
    if (NOT_DROP_BAR.test(name.replace(/ /g, '-')) || /overvolt|explorer/.test(name)) return [];
    const frame = FRAMES.find(([re]) => re.test(name)) ?? FRAMES.find(([re]) => re.test(slug));
    if (!frame) return [];
    const model = frame[2];
    const category = categoryFrom(model, [
      [/aerostorm/i, 'aero'], [/pulsium|sensium/i, 'endurance'], [/crosshill/i, 'gravel'],
    ], 'race');
    // No page states a model year, so the build dates each one by its capture.
    return [{ model, category, sizes: tables[0] }];
  },
};
export default adapter;
