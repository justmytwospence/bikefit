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
    // Pages before about 2022 lead every row with the drawing's letter (A Seat Tube Length ...): drop that column.
    $('table').each((_, t) => {
      if ($(t).find('td.code').length) $(t).find('tr').each((_, tr) => void $(tr).children('td,th').first().remove());
    });
    const tables = geometryTables($.html());
    if (!tables.length) return [];
    // The cart dialog's screen-reader heading can come first; else the page title before ' (2019) | ...'.
    const title = $('h1').not('.sr-only').first().text().trim() || $('title').text().split(/\s[(|]/)[0].trim();
    const model = familyName(title, ['compact']);
    if (!model || /cart|e\+|eplus/i.test(model)) return [];
    // The page title carries the model year: TCR Advanced 2 (2019) | Men Race bike | Giant Bicycles United States.
    // Pages of older bikes stay online for years, so it dates a page better than its capture does.
    const year = Number($('title').text().match(/\((20\d\d)\)/)?.[1]) || undefined;
    const category = categoryFrom(model, [
      [/propel/i, 'aero'], [/defy|contend/i, 'endurance'], [/revolt|toughroad/i, 'gravel'], [/tcx/i, 'cyclocross'],
    ], 'race');
    return [{ model, year, category, sizes: tables.sort((a, b) => b.length - a.length)[0] }];
  },
};
export default adapter;
