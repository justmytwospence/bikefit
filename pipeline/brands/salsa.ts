import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Product pages with the geometry as an HTML table, in three templates:
//  - /bikes/<family>/<year>_<family>_<build>, until about mid 2021 (rows are lettered 'M. Stack', a metric block then an
//    inch block);
//  - /products/<year>-<family>-<build> on the Shopify shop, from early 2025: `<table id="geoTable">` in millimetres, or for
//    the archived 2018 to 2021 bikes a table of 'Stack Metric' rows (or lettered rows) in `.geometry-table`;
//  - the same shop's year-less handles of 2026 (flyway-, cutthroat-c-, fargo-32-), as `geoTable`.
// The pages between (late 2021 to 2024) are a React shell that loads the geometry from an API the archive kept only
// by model number, which nothing on the page names: those captures give no geometry and are skipped by extract().
const FAMILIES = 'warbird|warroad|cutthroat|fargo|vaya|journeyman|journeyer|stormchaser|marrakesh';
const OLD_DIRS = 'warbird|warroad|cutthroat|fargo|vaya|journeyman|journeyman_650b|stormchaser|marrakesh';
const MIN_YEAR = 2018;
const HOST = 'https?:\\/\\/(?:www\\.)?salsacycles\\.com(?::\\d+)?';

const OLD_RE = new RegExp(`^${HOST}\\/bikes\\/(${OLD_DIRS})\\/((20\\d\\d)_[a-z0-9_.]+)\\/?(?:[?#].*)?$`);
const SHOP_RE = new RegExp(
  `^${HOST}\\/products\\/((?:(20\\d\\d)[-_](${FAMILIES})(?:[-_][a-z0-9_.-]*)?)|(?:(flyway)-[a-z0-9-]+)|(?:(cutthroat)-c-[a-z0-9-]+)|(?:(fargo)-32-[a-z0-9-]+))\\/?(?:[?#].*)?$`,
);
/** Flat-bar builds of the drop-bar frames, and the 24 inch kids' Journeyman. */
const NOT_DROP_BAR = /flat[-_]?bar|(?:^|[-_])24(?:[-_]|$)|kids|youth/;

/** The frames a page title or heading starts with, longest first ('Fargo 32' before 'Fargo'). */
const FRAMES: [RegExp, string][] = [
  [/^fargo 32\b/i, 'Fargo 32'], [/^warbird\b/i, 'Warbird'], [/^warroad\b/i, 'Warroad'], [/^cutthroat\b/i, 'Cutthroat'],
  [/^fargo\b/i, 'Fargo'], [/^vaya\b/i, 'Vaya'], [/^journeyman\b/i, 'Journeyman'], [/^journeyer\b/i, 'Journeyer'],
  [/^stormchaser\b/i, 'Stormchaser'], [/^marrakesh\b/i, 'Marrakesh'], [/^flyway\b/i, 'Flyway'],
];

const adapter: Adapter = {
  brand: 'Salsa',
  file: 'salsa',
  prefixes: [
    'www.salsacycles.com/bikes/warbird/20', 'www.salsacycles.com/bikes/warroad/20', 'www.salsacycles.com/bikes/cutthroat/20',
    'www.salsacycles.com/bikes/fargo/20', 'www.salsacycles.com/bikes/vaya/20', 'www.salsacycles.com/bikes/journeyman/20',
    'www.salsacycles.com/bikes/journeyman_650b/20', 'www.salsacycles.com/bikes/stormchaser/20',
    'www.salsacycles.com/bikes/marrakesh/20',
    'www.salsacycles.com/products/20', 'www.salsacycles.com/products/flyway-', 'www.salsacycles.com/products/cutthroat-c-',
    'www.salsacycles.com/products/fargo-32-',
  ],
  seeds: [],
  accept(url) {
    const old = url.match(OLD_RE);
    if (old) {
      const [, dir, slug, year] = old;
      if (Number(year) < MIN_YEAR || NOT_DROP_BAR.test(slug)) return null;
      return { url: `https://www.salsacycles.com/bikes/${dir}/${slug}`, family: dir.replace(/_650b$/, '') };
    }
    const shop = url.match(SHOP_RE);
    if (!shop) return null;
    const [, handle, year, family, flyway, cutthroat, fargo] = shop;
    if ((year && Number(year) < MIN_YEAR) || NOT_DROP_BAR.test(handle)) return null;
    // The 2026 Fargo 32 is a frame of its own; every other Fargo handle is the Fargo.
    const key = family ?? (fargo ? 'fargo-32' : flyway ?? cutthroat);
    return { url: `https://www.salsacycles.com/products/${handle.replace(/\/$/, '')}`, family: key };
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    // The heading names the frame and its build ('Warbird C GRX 820', '2022 Cutthroat C GRX 810 2x'). The older pages'
    // titles lead with the year ('2019 Warbird Carbon 105 700 | Salsa Cycles') or shout the name without one ('FARGO
    // TI FRAMESET | Salsa Cycles'); the shop's are marketing copy ('Carbon Bikepacking Bike - Cutthroat C GRX 810 2x').
    const names = [$('h1').first().text(), $('head title').first().text()].map((t) => {
      const text = t.replace(/\s+/g, ' ').trim();
      const year = text.match(/^(20\d\d)\s+(?=\S)/);
      return { year: year?.[1], name: (year ? text.slice(year[0].length) : text).split(/\s[|–—]\s/)[0].trim() };
    });
    const named = names.find((n) => FRAMES.some(([re]) => re.test(n.name)));
    const model = named && FRAMES.find(([re]) => re.test(named.name))![1];
    if (!model || names.some((n) => /flat.?bar/i.test(n.name))) return [];
    // Metric block of the older pages (the inch block follows it), else the Shopify table: `#geoTable`, or for the
    // archived bikes a rich-text table of 'Stack Metric' rows. Each is rebuilt as a clean table: the older markup
    // nests its tables badly.
    const source = [$('.metric-geo').first(), $('#geoTable').first(), $('.geometry-table table').first()].find((x) => x.length) ?? $();
    const rows: string[][] = [];
    source.find('tr').each((_, tr) => {
      const cells = $(tr).children('th,td').toArray().map((c) => $(c).text().replace(/\s+/g, ' ').trim());
      if (cells.length > 2) rows.push(cells);
    });
    if (rows.length < 3) return [];
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const html = `<table>${rows.map(([label, ...cells], i) => {
      // 'C. Headtube Angle' and 'E. Total Seat Tube Length' use words labels.ts does not know.
      const l = i === 0 ? label : label.replace(/^[A-Z]{1,2}\.\s*/, '')
        .replace(/^head ?tube angle/i, 'Head Tube Angle').replace(/^head ?tube length/i, 'Head Tube Length')
        .replace(/^total seat tube length/i, 'Seat Tube Length');
      return `<tr><th>${esc(l)}</th>${cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`;
    }).join('')}</table>`;
    const sizes = geometryTables(html)[0];
    if (!sizes) return [];
    // The year the page states: its heading or title, else the year its URL leads the slug with.
    const year = Number(names.find((n) => n.year)?.year ?? page.url.match(/\/(20\d\d)[-_][a-z]/)?.[1]) || undefined;
    const category = categoryFrom(model, [[/warroad/i, 'endurance'], [/stormchaser/i, 'cyclocross']], 'gravel');
    return [{ model, year, category, sizes }];
  },
};
export default adapter;
