import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { familyName, geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

const LINES = /^(?:s-works-)?(tarmac|aethos|venge|roubaix|diverge|crux|allez|sl\d)/;

const adapter: Adapter = {
  brand: 'Specialized',
  file: 'specialized',
  prefixes: ['www.specialized.com/us/en/'],
  seeds: [],
  accept(url) {
    const m = url.match(/^https?:\/\/www\.specialized\.com\/us\/en\/([a-z0-9-]+)\/p\/\d+/);
    if (!m || !LINES.test(m[1]) || /turbo|-e-|kids|frameset-|helmet|shoe/.test(m[1])) return null;
    const slug = m[1].replace(/^s-works-/, '');
    return { url: url.replace(/[?#].*$/, '').replace(/^http:/, 'https:'), family: slug.split('-').slice(0, 2).join('-') };
  },
  extract(page) {
    const tables = geometryTables(page.html);
    if (!tables.length) return [];
    const $ = cheerio.load(page.html);
    const title = $('h1').first().text().trim() || $('title').first().text().trim();
    const named = familyName(title.replace(/^(20\d\d\s+)?(Specialized\s+)?(20\d\d\s+)?(S-Works\s+)?/i, ''));
    const line = named.match(/^(Tarmac SL\d+|Tarmac|Aethos|Venge|Roubaix SL\d+|Roubaix|Diverge STR|Diverge|Crux|Allez Sprint|Allez)\b/i)?.[1];
    if (!line) return [];
    const model = line.replace(/^crux$/i, 'Crux');
    const category = categoryFrom(model, [[/venge/i, 'aero'], [/roubaix/i, 'endurance'], [/diverge|crux/i, 'gravel']], 'race');
    return [{ model, category, sizes: tables[0] }];
  },
};
export default adapter;
