import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { familyName, geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Liv is Giant's women's brand on the same storefront: the page markup is Giant's.
const LINES = /^(langma|enviliv|avail|devote|brava)-/;
// Family key: at most two slug words, cut at the first number or build word (avail-ar-3-2020 -> avail-ar, avail-3 -> avail).
const STOP = /^(\d.*|pro|disc|se)$/;

const adapter: Adapter = {
  brand: 'Liv',
  file: 'liv',
  prefixes: ['www.liv-cycling.com/us/'],
  seeds: [],
  accept(url) {
    const m = url.match(/^https?:\/\/www\.liv-cycling\.com\/us\/([a-z0-9-]+)\/?(?:[?#].*)?$/);
    // Pages of bikes from before 2018 stay online with the year in the slug (avail-1-2015, brava-slr--2017--2016).
    if (!m || !LINES.test(m[1]) || /e-?plus|-e-|series|testing|spacer|kids|junior|-20(0\d|1[0-7])(-|$)/.test(m[1])) return null;
    const words = m[1].replace(/-20\d\d$/, '').split('-').filter(Boolean);
    const cut = words.findIndex((w, i) => i > 0 && STOP.test(w));
    const family = words.slice(0, cut < 0 ? 2 : Math.min(cut, 2)).join('-');
    return { url: `https://www.liv-cycling.com/us/${m[1]}`, family };
  },
  extract(page) {
    // Each cell carries a millimetre and an inch span; keep the millimetres.
    const $ = cheerio.load(page.html);
    $('.value-inch, .unit-label').remove();
    // Rows lead with the drawing's letter in a cell of its own, a td until mid 2023 and a th until mid 2025: drop that
    // column. Since late 2025 the letter is a span inside the label cell, which the label mapping ignores.
    $('table').each((_, t) => {
      if ($(t).find('tr > td.code, tr > th.code').length) $(t).find('tr').each((_, tr) => void $(tr).children('td,th').first().remove());
    });
    const tables = geometryTables($.html());
    if (!tables.length) return [];
    // The title carries the model year: Langma Advanced Pro 1 Disc (2019) | Women Race bike | Liv Cycling United States.
    // Pages of older bikes stay online for years, so it dates a page better than its capture does.
    const year = Number($('title').text().match(/\((20\d\d)\)/)?.[1]) || undefined;
    if (year && year < 2018) return [];
    // The cart dialog's screen-reader heading can come first; else the page title before ' (2019) | ...'.
    const title = ($('h1').not('.sr-only').first().text().trim() || $('title').text().split(/\s[(|]/)[0].trim())
      .replace(/\s*\([^)]*\)/g, '').replace(/\bBe Good\S*/i, '').replace(/(\d)-(?=[a-z])/gi, '$1 ').replace(/^Enviliv\b/i, 'EnviLiv')
      // Langma Advanced Disc 1+ AR (2022) is a Langma build with wider tyres; Avail AR is its own model.
      .replace(/^(?!Avail)(.*)\s+AR$/i, '$1');
    const model = familyName(title, ['pc']);
    if (!model || /cart|e\+|eplus/i.test(model)) return [];
    const category = categoryFrom(model, [
      [/enviliv/i, 'aero'], [/avail/i, 'endurance'], [/devote/i, 'gravel'], [/brava/i, 'cyclocross'],
    ], 'race');
    return [{ model, year, category, sizes: tables.sort((a, b) => b.length - a.length)[0] }];
  },
};
export default adapter;
