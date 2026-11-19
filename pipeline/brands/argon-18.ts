import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Model slug (path segment after /bikes/<group>/) to model name and category; first match wins.
const LINES: [RegExp, string, FrameCategory][] = [
  [/^krypton-pro/, 'Krypton Pro', 'endurance'],
  [/^krypton-cs/, 'Krypton CS', 'endurance'],
  [/^krypton-gf/, 'Krypton GF', 'endurance'],
  [/^krypton$/, 'Krypton', 'endurance'],
  [/^gallium-cs-disc/, 'Gallium CS Disc', 'race'],
  [/^gallium-pro-disc/, 'Gallium Pro Disc', 'race'],
  [/^gallium-pro/, 'Gallium Pro', 'race'],
  [/^gallium-disc/, 'Gallium Disc', 'race'],
  [/^gallium$/, 'Gallium', 'race'],
  [/^sum-pro/, 'Sum Pro', 'race'],
  [/^sum$/, 'Sum', 'race'],
  [/^equation/, 'Equation', 'race'],
  [/^nitrogen-pro/, 'Nitrogen Pro', 'aero'],
  [/^nitrogen-disc/, 'Nitrogen Disc', 'aero'],
  [/^nitrogen$/, 'Nitrogen', 'aero'],
  [/^dark-matter/, 'Dark Matter', 'gravel'],
  [/^grey-matter/, 'Grey Matter', 'gravel'],
  [/^anti-matter/, 'Anti Matter', 'gravel'],
];

// Since 2020 the site lives on argon18.com (before, argon18bike.com: its geometry is only in the Tech Card PDFs).
// /en/bikes before 2022, then one tree per region.
const URL_RE = /^https?:\/\/(?:www\.)?argon18\.com\/(en|en-us|en-ca)\/bikes\/([a-z0-9-]+)\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?\/?(?:[?#].*)?$/;

function lineOf(group: string, a: string, b?: string): { model: string; category: FrameCategory } | null {
  if (/^(electric|e-performance|triathlon|triathlon-tt|time-trial|track)$/.test(group)) return null;
  // Legacy pages nest the build under the product (/legacy-products/krypton/krypton-gf-sram-rival-axs): the build slug names it best.
  for (const slug of [b, a]) {
    if (!slug) continue;
    const hit = LINES.find(([re]) => re.test(slug));
    if (hit) return { model: hit[1], category: hit[2] };
  }
  return null;
}

const adapter: Adapter = {
  brand: 'Argon 18',
  file: 'argon-18',
  prefixes: ['www.argon18.com/en/bikes/', 'www.argon18.com/en-us/bikes/', 'www.argon18.com/en-ca/bikes/'],
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    if (!m) return null;
    const [, locale, group, a, b] = m;
    if (/eroad|egravel|subito|-e-|electric/.test(`${a}/${b ?? ''}`)) return null;
    const line = lineOf(group, a, b);
    if (!line) return null;
    return { url: `https://www.argon18.com/${locale}/bikes/${group}/${a}${b ? `/${b}` : ''}`, family: line.model.toLowerCase().replace(/ /g, '-') };
  },
  extract(page) {
    const m = page.url.match(URL_RE);
    const line = m ? lineOf(m[2], m[3], m[4]) : null;
    if (!line) return [];
    // The table is made of divs: a row per measure, one cell per size (data-geometry-size), the unit in the label cell.
    // Sizes the model is not built in have empty cells, and so no stack and reach: geometryTables drops them.
    const $ = cheerio.load(page.html);
    const sizes: string[] = [];
    const rows: [string, Map<string, string>][] = [];
    $('#geometries-table .row').each((_, row) => {
      const label = $(row).find('.label .text').text().replace(/\s+/g, ' ').trim();
      const unit = $(row).find('.label .unit').text().trim().toLowerCase();
      const cells = new Map<string, string>();
      $(row).find('.cell.data').each((_, c) => {
        const size = $(c).attr('data-geometry-size') ?? '';
        let text = $(c).text().replace(/\s+/g, ' ').trim().replace(',', '.');
        // Lengths are in cm with one decimal: hand over millimetres, since parseValue would round a head tube of 7.6 cm to 8.
        if (unit === 'cm' && /^\d+(\.\d+)?$/.test(text)) text = String(Math.round(Number(text) * 100) / 10);
        if (!sizes.includes(size)) sizes.push(size);
        cells.set(size, text);
      });
      if (label && cells.size) rows.push([label, cells]);
    });
    if (!rows.length) return [];
    const table = '<table><tr><th>Size</th>' + sizes.map((s) => `<th>${s}</th>`).join('') + '</tr>'
      + rows.map(([label, cells]) => `<tr><th>${label}</th>` + sizes.map((s) => `<td>${cells.get(s) ?? ''}</td>`).join('') + '</tr>').join('')
      + '</table>';
    const tables = geometryTables(table);
    if (!tables.length) return [];
    return [{ model: line.model, category: line.category, sizes: tables[0] }];
  },
};
export default adapter;
