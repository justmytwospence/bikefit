import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Model-year pages, MY2016 to MY2025: www.marinbikes.com/bikes/<year>-<slug> (mid-2020 also /bikes/20-<slug>).
// The Shopify store, from late 2025: marinbikes.com/products/<handle>, where a handle may lead with its model year
// (2026-gestalt-2), a 2025.1 revision (2025-1-headlands-1) or nothing (headlands-3), and may be a copy of another year's
// product (2024-gestalt-xr-copy is the 2025 Gestalt XR).
const URL_RE = /^https?:\/\/(?:www\.)?marinbikes\.com(?::80)?\/(bikes|products)\/([a-z0-9-]+)\/?(?:[?#].*)?$/;

/**
 * Drop-bar lines, by product name or URL slug (lower case, words split by spaces), to model and category; first match
 * wins. Builds of one frame share a name (Gestalt 1, 2, 3, base; Headlands 1, 2, 3; X10, X11 and XR of the Gestalt X);
 * Nicasio 2, Nicasio ST and Nicasio Ridge list their own geometry next to the Nicasio's in the same years, and the 2025.1
 * Nicasio 3 is a build of the Nicasio 2's frame (the same table).
 * Marin files every one of them under Gravel/Beyond Road, except the Cortina (Series 4 CX) and the Argenta and Ravenna
 * (endurance road).
 */
const LINES: [RegExp, string][] = [
  [/^gestalt x/, 'Gestalt X'], [/^gestalt/, 'Gestalt'], [/^headlands/, 'Headlands'], [/^four corners/, 'Four Corners'],
  [/^nicasio ridge/, 'Nicasio Ridge'], [/^nicasio st\b/, 'Nicasio ST'], [/^nicasio [23]\b/, 'Nicasio 2'], [/^nicasio/, 'Nicasio'],
  [/^lombard/, 'Lombard'], [/^cortina/, 'Cortina'], [/^argenta/, 'Argenta'], [/^ravenna/, 'Ravenna'],
];
const CATEGORIES: [RegExp, FrameCategory][] = [[/^cortina/i, 'cyclocross'], [/^(?:argenta|ravenna)/i, 'endurance']];

// The Nicasio RC has a swept-back city bar; Lombard E and the like are e-bikes; Jr bikes are for kids.
const NOT_DROP_BAR = /^nicasio rc\b|\b(?:e\d?|el|electric|jr|kids|bosch|int)\b/;
// The Nicasio+ is a build of the Nicasio's frame (the same table on 2020 to 2022 and 2025 pages), but its 2023 and
// 2024 pages list the Nicasio's 47 to 58 cm numbers under 50 to 60: leave its pages out, the Nicasio's carry the frame.
const SKIP = /^nicasio[- ]plus\b/;

/** The line of a name or slug: 'Gestalt X' for '2025 Gestalt XR' or 'gestalt-x10', null when not a drop-bar line. */
function lineOf(name: string): { model: string; category: FrameCategory } | null {
  const n = name.toLowerCase().replace(/\+/g, ' plus ').replace(/[^a-z0-9.]+/g, ' ').replace(/^frame kit /, '').trim();
  if (NOT_DROP_BAR.test(n)) return null;
  const hit = LINES.find(([re]) => re.test(n));
  return hit ? { model: hit[1], category: categoryFrom(hit[1], CATEGORIES, 'gravel') } : null;
}

/** Row labels as labels.ts names them: 'C HEADTUBE ANGLE' is a head tube angle, 'E Seattube angle' a seat tube angle. */
const label = (s: string) => s.replace(/\s+/g, ' ').trim()
  .replace(/^[A-Z]\s+(?=\S)/, '')
  .replace(/head\s*tube/gi, 'head tube').replace(/seat\s*tube/gi, 'seat tube').replace(/top\s*tube/gi, 'top tube');

const adapter: Adapter = {
  brand: 'Marin',
  file: 'marin',
  // Model-year paths from 2018 only (the bare /bikes/ prefix also lists 2015 to 2017, family and type pages); store
  // handles that lead with a year or name a drop-bar line (the bare /products/ prefix lists parts and clothing).
  prefixes: [
    ...['2018', '2019', '20', '2020', '2021', '2022', '2023', '2024', '2025'].map((y) => `marinbikes.com/bikes/${y}-`),
    ...['20', 'gestalt', 'headlands', 'nicasio', 'four-corners', 'lombard', 'frame-kit-'].map((p) => `marinbikes.com/products/${p}`),
  ],
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    if (!m) return null;
    const [, kind, slug] = m;
    const y = slug.match(/^(20\d\d|20)-(?:\d-)?(.+)$/);
    // /bikes/ pages always lead with their model year; store handles may not.
    if (kind === 'bikes' && !y) return null;
    const year = y ? (y[1] === '20' ? 2020 : Number(y[1])) : undefined;
    if (year !== undefined && year < 2018) return null;
    const rest = y ? y[2] : slug;
    const line = SKIP.test(rest) ? null : lineOf(rest.replace(/-/g, ' '));
    if (!line) return null;
    // One family per line and model year: the builds of a frame (Gestalt 1, 2, 2.5, frame kit) carry its geometry.
    const key = line.model.toLowerCase().replace(/\s+/g, '-');
    const host = kind === 'bikes' ? 'www.marinbikes.com' : 'marinbikes.com';
    return { url: `https://${host}/${kind}/${slug}`, family: year ? `${key}@${year}` : key };
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    // Store pages: the product name with its year and Marin's own categories, in the Klaviyo tracking script.
    const item = page.html.match(/var item = \{([^}]*)\}/)?.[1] ?? '';
    const product = item.match(/Name:\s*"([^"]+)"/)?.[1];
    const categories = item.match(/Categories:\s*\[([^\]]*)\]/)?.[1];
    if (categories !== undefined && !/"Drop Bar"/.test(categories)) return [];
    // A bike whose spec names a handlebar without a drop is not a drop-bar bike (the Nicasio RC's city bar).
    const bar = $('h3, h4').filter((_, h) => $(h).text().trim() === 'Handlebar').first().next('p').text();
    if (bar && !/drop/i.test(bar)) return [];
    // Model-year pages: <title>Marin Bikes | 2022 Gestalt 1</title> (the year until 2022); store pages:
    // <title>2025 Nicasio 2 &ndash; Marin Bikes Global</title> or <title>Gestalt 2 &ndash; Marin Bikes</title>.
    const title = $('title').first().text().split(/\s+[|–]\s+/).map((s) => s.trim()).find((s) => s && !/^marin bikes\b/i.test(s)) ?? '';
    const heading = $('h2.bike-header__title, h1.headline-sm').first().text().replace(/\s+/g, ' ').trim();
    const name = product ?? (/^20\d\d\b/.test(title) ? title : heading || title);
    const stated = name.match(/^(20\d\d)(?:\.\d)?\s+(.*)$/);
    const line = lineOf(stated ? stated[2] : name);
    if (!line) return [];
    // A model-year path states the year when the title does not (2023 to 2025); a store handle's year can be a copy's.
    const path = page.url.match(/\/bikes\/(20\d\d|20)-/)?.[1];
    const year = Number(stated?.[1] ?? (path === '20' ? 2020 : path)) || undefined;

    const geo = $('.geometry__table table, table.geometry-table');
    const scope = geo.length ? geo : $('table');
    // Each row leads with the drawing's letter (A Stack), in its own span or, on some pages, bare.
    scope.find('.letter-char, .diagram-letter').remove();
    scope.each((_, t) => void $(t).find('tr').each((r, tr) => {
      const cells = $(tr).children('td,th');
      // Sizes read '50cm' on 2018 and 2019 pages and '50' after.
      if (!r) cells.each((_, c) => void $(c).text($(c).text().replace(/\s+/g, ' ').trim().replace(/^(\d+)\s*cm$/i, '$1')));
      else cells.first().text(label(cells.first().text()));
    }));
    const tables = scope.toArray().flatMap((t) => geometryTables($.html(t)));
    if (!tables.length) return [];
    return [{ model: line.model, year, category: line.category, sizes: tables.sort((a, b) => b.length - a.length)[0] }];
  },
};
export default adapter;
