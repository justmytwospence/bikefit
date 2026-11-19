import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Three eras, all with the geometry in an HTML table of centimetres:
// - 2018, the old site: /our-bikes/titanium/{t-series|adventure}/<year>-<model>, the model year in the path;
// - 2019 to 2023, Shopify: /products/<handle>, a table whose first column is the drawing's letter;
// - 2023 on: the table has the sizes down the side (metric and inch copies), or plain labels across the top.
// Titanium drop-bar families only. Handles are the bike (arenberg), its frame (arenberg-frame) and its FI twin
// (arenberg-fi, arenberg-fi-frame), which share one geometry and so one family. Everything else under /products/
// (wheelsets, drivetrains, size-m "scratch and dent" listings, _pplr_ pre-orders, decals, limited editions, the
// Cherohala City and the mountain and e-bikes) fails the handle test.
const HANDLE = /^(arenberg|cherohala|coll-dels-reis|flint|ghisallo|spezia|toscano|ultimate(?:-disc|-g2|-gravel)?|t1sl(?:-disc)?|t2(?:-disc)?|t5g?(?:-disc)?|gravel)(?:-fi)?(?:-frame)?$/;
const SHOP = /^https?:\/\/(?:www\.)?litespeed\.com(?::80)?\/((?:collections\/[a-z0-9-]+\/)?)products\/([a-z0-9_-]+)\/?(?:[?#].*)?$/;
// Old site, model year 2018 on (the 2017 and older bikes are before the catalog starts).
const OLD = /^https?:\/\/(?:www\.)?litespeed\.com(?::80)?\/our-bikes\/titanium\/(t-series|adventure)\/(20(?:1[89]|2\d))-(cherohala-se|gravel|t1sl(?:-disc)?|t2(?:-disc)?|t5g?(?:-disc)?)\/?(?:[?#].*)?$/;

/** The frames, as their pages name them (lower case) and as the catalog lists them. */
const FRAMES: Record<string, string> = Object.fromEntries([
  'Arenberg', 'Cherohala', 'Cherohala SE', 'Coll dels Reis', 'Flint', 'Ghisallo', 'Gravel', 'Spezia', 'T1sl', 'T1sl Disc', 'T2',
  'T2 Disc', 'T5', 'T5 Disc', 'T5G', 'Toscano', 'Ultimate', 'Ultimate Disc', 'Ultimate G2', 'Ultimate Gravel',
].map((m) => [m.toLowerCase(), m]));

/** A heading or title cut down to the frame: no 'Litespeed', 'Titanium ...', 'Frame', 'Bike' or 'FI' (the FI twin has its geometry). */
function tidy(s: string): string {
  let name = s.replace(/\s+/g, ' ').trim().replace(/^litespeed\s+/i, '').replace(/^titanium\s+/i, '').replace(/\s+titanium\b.*$/i, '');
  for (let again = true; again;) {
    const next = name.replace(/\s+(?:frame or frameset|frameset|frame|bike|bicycle|fi)$/i, '');
    again = next !== name;
    name = next;
  }
  return name;
}

const adapter: Adapter = {
  brand: 'Litespeed',
  file: 'litespeed',
  prefixes: [
    'litespeed.com/products/arenberg', 'litespeed.com/products/cherohala', 'litespeed.com/products/coll-dels-reis',
    'litespeed.com/products/flint', 'litespeed.com/products/ghisallo', 'litespeed.com/products/gravel',
    'litespeed.com/products/spezia', 'litespeed.com/products/t1sl', 'litespeed.com/products/t2',
    'litespeed.com/products/t5', 'litespeed.com/products/toscano', 'litespeed.com/products/ultimate',
    // Some 2019 to 2025 captures exist only under the collection the shop linked from.
    'litespeed.com/collections/titanium-gravel-bikes/products/', 'litespeed.com/collections/titanium-road-bikes/products/',
    'litespeed.com/collections/titanium-frames/products/',
    'litespeed.com/our-bikes/titanium/t-series/2018', 'litespeed.com/our-bikes/titanium/adventure/2018',
  ],
  seeds: [],
  accept(url) {
    const old = url.match(OLD);
    if (old) return { url: `https://litespeed.com/our-bikes/titanium/${old[1]}/${old[2]}-${old[3]}`, family: `${old[3]}@${old[2]}` };
    const shop = url.match(SHOP);
    // The shop of 2019 named some frame pages litespeed-t2-frameset and litespeed-ultimate-disc-frame-or-frameset.
    const handle = shop?.[2].replace(/^litespeed-(t[125][a-z0-9-]*|ultimate(?:-disc)?)-(?:frame-or-)?frameset$/, '$1').match(HANDLE);
    if (!shop || !handle) return null;
    // A capture belongs to the exact path it was archived under, so a collection-nested page keeps its collection.
    return { url: `https://litespeed.com/${shop[1]}products/${shop[2]}`, family: handle[1] };
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    // Pages of 2023 on carry each table twice, in inches and in centimetres: keep the centimetres.
    $('.inchestable, table.inchestable').remove();
    $('table').each((_, t) => {
      const table = $(t);
      // A blank header row (the 2026 table) would be read as the size labels.
      table.find('tr').each((_, tr) => {
        if (!$(tr).text().trim()) $(tr).remove();
      });
      // Pages of 2019 to 2023 lead every row with the drawing's letter (A, B, ...) and put the label in the next cell.
      const rows = table.find('tr').toArray();
      if (rows.filter((tr) => /^[A-Z]$/.test($(tr).children('td,th').first().text().trim())).length >= 4) {
        rows.forEach((tr) => void $(tr).children('td,th').first().remove());
      }
    });
    const tables = geometryTables($.html());
    if (!tables.length) return [];
    const titles = [$('title').text().split(/\s[|–—-]\s/)[0]];
    const ld = $('script[type="application/ld+json"]').map((_, el) => {
      try {
        const data = JSON.parse($(el).text());
        return typeof data?.name === 'string' && data['@type'] === 'Product' ? data.name : '';
      } catch {
        return '';
      }
    }).get();
    const names = [$('h1.product_name').first().text(), ...ld, ...$('h1').map((_, h) => $(h).text()).get(), ...titles];
    const model = names.map((n) => FRAMES[tidy(n).toLowerCase()]).find(Boolean);
    if (!model) return [];
    // The old site's breadcrumb links the model year (title="2018"), and so does its path; the Shopify pages state none.
    const old = page.url.includes('/our-bikes/');
    const year = old
      ? Number($('a[title]').map((_, a) => $(a).attr('title')).get().find((t) => /^20\d\d$/.test(t ?? ''))
        ?? page.url.match(/\/(20\d\d)-[a-z0-9-]+\/?$/)?.[1]) || undefined
      : undefined;
    const category = categoryFrom(model, [
      [/^(?:ultimate gravel|ultimate g2|flint|toscano|t5g|gravel)$/i, 'gravel'],
      [/^(?:arenberg|cherohala|t5(?: disc)?)\b/i, 'endurance'],
    ], 'race');
    return [{ model, year, category, sizes: tables.sort((a, b) => b.length - a.length)[0] }];
  },
};
export default adapter;
