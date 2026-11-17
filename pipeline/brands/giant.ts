import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { familyName, geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

const LINES = /^(tcr|propel|defy|contend|revolt|tcx|toughroad)/;

const adapter: Adapter = {
  brand: 'Giant',
  file: 'giant',
  prefixes: ['www.giant-bicycles.com/us/'],
  seeds: [],
  accept(url) {
    const m = url.match(/^https?:\/\/www\.giant-bicycles\.com\/us\/([a-z0-9-]+)\/?(?:[?#].*)?$/);
    if (!m || !LINES.test(m[1]) || /-e-|e\+|kids|junior/.test(m[1])) return null;
    const slug = m[1].replace(/-20\d\d$/, '');
    return { url: `https://www.giant-bicycles.com/us/${m[1]}`, family: slug.split('-').slice(0, 2).join('-') };
  },
  extract(page) {
    // Each cell carries a millimetre and an inch span; keep the millimetres.
    const $ = cheerio.load(page.html);
    $('.value-inch, .unit-label').remove();
    const tables = geometryTables($.html());
    if (!tables.length) return [];
    const title = $('h1').first().text().trim();
    const model = familyName(title);
    if (!model || /cart|e\+|eplus/i.test(model)) return [];
    const category = categoryFrom(model, [
      [/propel/i, 'aero'], [/defy|contend/i, 'endurance'], [/revolt|toughroad/i, 'gravel'], [/tcx/i, 'cyclocross'],
    ], 'race');
    return [{ model, category, sizes: tables.sort((a, b) => b.length - a.length)[0] }];
  },
};
export default adapter;
