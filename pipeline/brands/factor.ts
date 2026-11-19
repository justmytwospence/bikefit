import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { geometryTables } from '../lib/extract';
import type { Adapter, PartialSize } from '../types';

// Model slug (suffixes like -aero-road-bike already cut) to family, model name and category.
const LINES: Record<string, [string, string, FrameCategory]> = {
  'o2': ['o2', 'O2', 'race'],
  'o2-vam': ['o2-vam', 'O2 VAM', 'race'],
  'vam': ['o2-vam', 'O2 VAM', 'race'],
  'one': ['one', 'One', 'aero'],
  'one-2': ['one', 'One', 'aero'],
  'one-s': ['one-s', 'One S', 'aero'],
  'ostro': ['ostro-vam', 'Ostro VAM', 'aero'],
  'ostro-vam': ['ostro-vam', 'Ostro VAM', 'aero'],
  'monza': ['monza', 'Monza', 'race'],
  'vista': ['vista', 'Vista', 'endurance'],
  'ls': ['ls', 'LS', 'gravel'],
  'ostro-gravel': ['ostro-gravel', 'Ostro Gravel', 'gravel'],
  'aluto': ['aluto', 'Aluto', 'gravel'],
  'sarana': ['sarana', 'Sarana', 'gravel'],
  'elara': ['elara', 'Elara', 'gravel'],
};

// Three site generations, all at the root (US) locale:
// 2018-2021 /models/<slug>/ (WordPress), 2022-2023 /products/<slug>-<kind>-bike/ (WooCommerce), since late 2023 /bikes/<slug> (Next.js).
const URL_RE = /^https?:\/\/(?:www\.)?factorbikes\.com\/(models|products|bikes)\/([a-z0-9-]+)\/?(?:[?#].*)?$/;

function lineOf(kind: string, slug: string): { family: string; model: string; category: FrameCategory } | null {
  // Limited editions and quote-request pages mostly carry no geometry and repeat a base model.
  if (/edition|quote|scarab|old-layout|bugatti/.test(slug)) return null;
  const base = kind === 'products' ? slug.replace(/-(?:aero-road|road|gravel|triathlon|tt)-bike$/, '') : slug;
  const hit = LINES[base];
  return hit ? { family: hit[0], model: hit[1], category: hit[2] } : null;
}

/** The balanced JSON value starting at s[i] ('{' or '['), or null. */
function balanced(s: string, i: number): string | null {
  let depth = 0;
  let str = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (str) {
      if (c === '\\') j++;
      else if (c === '"') str = false;
    } else if (c === '"') str = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      if (--depth === 0) return s.slice(i, j + 1);
    }
  }
  return null;
}

// Abbreviated labels on some pages (OSTRO VAM 2021, OSTRO Gravel 2023) that labels.ts does not know.
const ABBREV: [RegExp, string][] = [
  [/^ST angle\b/i, 'Seat Tube Angle'], [/^HT angle\b/i, 'Head Tube Angle'], [/^ST$/i, 'Seat Tube Length'], [/^HT$/i, 'Head Tube Length'],
];
const relabel = (x: string) => ABBREV.reduce((s, [re, to]) => s.replace(re, to), x.trim());

const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** The /bikes pages embed Contentful data: frameGeometry.geometry = { headers: ['', 'Size', '49', ...], rows: [['A', 'Stack', '503', ...], ...] }. */
function jsonTables(html: string): PartialSize[][] {
  const out: PartialSize[][] = [];
  const key = '"frameGeometry":{"geometry":';
  for (let i = html.indexOf(key); i >= 0; i = html.indexOf(key, i + key.length)) {
    const raw = balanced(html, i + key.length);
    if (!raw) continue;
    let g: { headers?: string[]; rows?: string[][] };
    try {
      g = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!g.headers || !g.rows) continue;
    // The first column holds the drawing's letter: drop it.
    const tr = (cells: string[]) => `<tr>${cells.slice(1).map((c, i) => `<td>${esc(i ? String(c) : relabel(String(c)))}</td>`).join('')}</tr>`;
    out.push(...geometryTables(`<table>${tr(g.headers)}${g.rows.map(tr).join('')}</table>`));
  }
  return out;
}

/** Older pages render an HTML table; since 2022 its first column is the drawing's letter (A Stack ...). */
function htmlTables(html: string): PartialSize[][] {
  const $ = cheerio.load(html);
  $('table').each((_, t) => {
    const rows = $(t).find('tr').toArray();
    const firsts = rows.map((tr) => $(tr).children('td,th').first().text().trim());
    if (rows.length > 3 && firsts.slice(1).every((x) => /^[A-Z]?$/.test(x)) && firsts.slice(1).some(Boolean)) {
      for (const tr of rows) $(tr).children('td,th').first().remove();
    }
    for (const tr of rows) {
      const c = $(tr).children('td,th').first();
      c.text(relabel(c.text()));
    }
  });
  return geometryTables($.html());
}

const adapter: Adapter = {
  brand: 'Factor',
  file: 'factor',
  prefixes: ['factorbikes.com/models/', 'factorbikes.com/products/', 'factorbikes.com/bikes/'],
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    const line = m && lineOf(m[1], m[2]);
    if (!line) return null;
    const trail = m![1] === 'bikes' ? '' : '/';
    return { url: `https://factorbikes.com/${m![1]}/${m![2]}${trail}`, family: line.family };
  },
  extract(page) {
    const m = page.url.match(URL_RE);
    const line = m && lineOf(m[1], m[2]);
    if (!line) return [];
    const tables = [...jsonTables(page.html), ...htmlTables(page.html)];
    if (!tables.length) return [];
    const sizes = tables.sort((a, b) => b.length - a.length)[0];
    return [{ model: line.model, category: line.category, sizes }];
  },
};
export default adapter;
