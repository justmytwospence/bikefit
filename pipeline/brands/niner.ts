import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Only the Magento shop (June 2021 on) has pages to read, and only from late 2024 does a product page carry its geometry
// as a table: the NetSuite shop (2018 to 2019, upper-case paths) and the Shopify shop (2019 to 2021, /products/) show a
// chart image, and so do the Magento pages until about December 2023. Those are not accepted, so discovery stays small.
const URL_RE = /^https?:\/\/(?:www\.)?ninerbikes\.com(?::80)?\/((?:rlt-9|ore-9)[a-z0-9-]*)\/?(?:[?#].*)?$/;

/** The family pages: configurable products with every size and build, no geometry table of their own. */
const FAMILY_PAGES = /^(?:rlt-9|rlt-9-rdo|rlt-9-steel|ore-9-rdo)\/?$/;

function familyOf(slug: string): string {
  if (slug.startsWith('ore-9-rdo')) return 'ore-9-rdo';
  if (slug.startsWith('rlt-9-rdo')) return 'rlt-9-rdo';
  if (slug.startsWith('rlt-9-steel')) return 'rlt-9-steel';
  return 'rlt-9';
}

/** The frames with drop bars; page titles shout them and follow with a build ('RLT 9 RDO - 3-STAR SRAM RIVAL 1', 'RLT 9 APEX XPLR'). */
const FRAMES: [RegExp, string][] = [
  [/^RLT 9 RDO\b/i, 'RLT 9 RDO'], [/^RLT 9 STEEL\b/i, 'RLT 9 Steel'], [/^RLT 9\b/i, 'RLT 9'], [/^ORE 9 RDO\b/i, 'ORE 9 RDO'],
];

const adapter: Adapter = {
  brand: 'Niner',
  file: 'niner',
  prefixes: ['www.ninerbikes.com/rlt-9', 'www.ninerbikes.com/ore-9'],
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    if (!m || FAMILY_PAGES.test(m[1])) return null;
    // 650b builds of the same frames show their chart as an image; electric RLT E9 pages are not under these prefixes.
    if (/650b|-e9|e-bike|electric|ebike/.test(m[1])) return null;
    return { url: `https://www.ninerbikes.com/${m[1]}/`, family: familyOf(m[1]) };
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    const table = $('.geoTable table').first();
    if (!table.length) return [];
    // The table holds a Metric block, then an Imperial one, each opened by a one-cell row ('Metric' with rowspan 7).
    // Keep the metric rows and give the size column a header.
    const cut = table.find('tr.subheader').first();
    cut.nextAll().remove();
    cut.remove();
    table.find('tr.data-title').remove();
    table.find('thead th[colspan]').remove();
    table.find('thead tr').first().prepend('<th>Size</th>');
    // Headers read '(I) Headtube Angle': drop the drawing's letter and spell out the words labels.ts needs.
    table.find('thead th').each((_, th) => {
      const label = $(th).text().replace(/^\s*\([A-Z]\)\s*/, '').replace(/\s+/g, ' ').trim()
        .replace(/^headtube angle/i, 'Head Tube Angle').replace(/^seattube angle/i, 'Seat Tube Angle')
        .replace(/^headtube length/i, 'Head Tube Length').replace(/^chainstay length actual/i, 'Chainstay Length')
        .replace(/^horizontal chainstay/i, 'Chainstay Horizontal');
      $(th).text(label);
    });
    const sizes = geometryTables($.html(table))[0];
    if (!sizes) return [];
    // familyName would take the 9 of 'RLT 9' for a build number and leave 'RLT 9 APEX XPLR' whole: name the frame from the list.
    const title = $('head title').first().text().trim() || $('h1 .base').first().text().trim();
    const model = FRAMES.find(([re]) => re.test(title))?.[1];
    if (!model) return [];
    const category = categoryFrom(model, [[/^(?:rlt|ore)\b/i, 'gravel']], 'gravel');
    return [{ model, category, sizes }];
  },
};
export default adapter;
