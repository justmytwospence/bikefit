import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter, PartialSize } from '../types';

const LINES = /^(?:s-works-)?(tarmac|aethos|venge|roubaix|diverge|crux|allez|sl\d)/;
// Longest first; a digit after the line is its generation (Aethos 2, Diverge 4, Crux 5).
const MODEL = /^(Tarmac SL\d+|Tarmac|Aethos \d\b|Aethos|Venge|Roubaix SL\d+|Roubaix|Diverge STR|Diverge \d\b|Diverge|Crux \d\b|Crux|Allez Sprint|Allez)\b/i;

/**
 * Model years by product id, for the pages that state none (the site before 2022). Ids were handed out in order:
 * of the 166 pinned pages below 199980 that do state a year, 163 fall in these bands (128885-153989 are 2018
 * bikes, 154294 on 2019, 170241 on 2020, 175282 on 2021, 199442 on 2022). Lower ids are bikes from before 2018,
 * which the build drops; later ids always state their year.
 */
function yearOfId(id: number): number | undefined {
  return id < 128800 ? 2017 : id < 154000 ? 2018 : id < 170000 ? 2019 : id < 175000 ? 2020 : id < 199000 ? 2021
    : id < 199980 ? 2022 : undefined;
}

/** The model year a page states: in its heading ('2018 Roubaix Comp'), else the first one in its product data. */
function statedYear(html: string, h1: string): number | undefined {
  return Number(h1.match(/^(20\d\d)\b/)?.[1] ?? html.match(/\\?"modelYear\\?":\s*(20\d\d)/)?.[1]) || undefined;
}

/**
 * Some pages list a row's values out of size order: archive pages rendered since 2025 (a stack of 519, 536,
 * 569, 590, 610, 643, 552) and the 2018 Crux, whose seat angles run backwards. Across the pinned pages every
 * sound table rises with size in stack, reach, head tube, seat tube and wheelbase (dips stay under 5 mm) and in
 * head angle, and falls in seat angle. A row that breaks this marks a table that cannot be trusted.
 */
function inOrder(sizes: PartialSize[]): boolean {
  const steps = (k: keyof Omit<PartialSize, 'size'>) =>
    sizes.slice(1).map((s, i) => (s[k] === undefined || sizes[i][k] === undefined ? 0 : s[k]! - sizes[i][k]!));
  return (['stack', 'reach', 'headTubeLength', 'seatTubeLength', 'wheelbase'] as const).every((k) => steps(k).every((d) => d >= -5))
    && steps('headTubeAngle').every((d) => d >= -0.3) && steps('seatTubeAngle').every((d) => d <= 0.3);
}

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
    if (!tables.length || !inOrder(tables[0])) return [];
    const $ = cheerio.load(page.html);
    const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
    const title = h1 || $('title').first().text().replace(/\s+/g, ' ').trim();
    const name = title.replace(/^(20\d\d\s+)?(Specialized\s+)?(20\d\d\s+)?(S-Works\s+)?/i, '');
    const line = name.match(MODEL)?.[1].replace(/^crux/i, 'Crux');
    if (!line) return [];
    // The aluminium Diverge and Crux (E5, later 'Alloy') and the pro-fit Roubaix Team are frames of their own.
    const model = /^(Diverge|Crux)\b/.test(line) && /\b(E5|Alloy)\b/i.test(name) ? `${line.replace(/ \d$/, '')} E5`
      : line === 'Roubaix' && /\bTeam\b/i.test(name) ? 'Roubaix Team' : line;
    const category = categoryFrom(model, [[/venge/i, 'aero'], [/roubaix/i, 'endurance'], [/diverge|crux/i, 'gravel']], 'race');
    const year = statedYear(page.html, h1) ?? yearOfId(Number(page.url.match(/\/p\/(\d+)/)?.[1]));
    // The site before 2020 labels sizes '490.0' or '48.0' where it later says '49' and '48'.
    const sizes = tables[0].map((s) => {
      const n = s.size.match(/^(\d+)\.0$/)?.[1];
      return n ? { ...s, size: String(Number(n) >= 100 ? Number(n) / 10 : Number(n)) } : s;
    });
    return [{ model, year, category, sizes }];
  },
};
export default adapter;
