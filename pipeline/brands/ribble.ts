import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter, PartialSize } from '../types';

// Model lines as URL slug prefixes (after "ribble-" and an optional year), longest first, with display names.
const LINES: [string, string][] = ([
  ['endurance-sl-r-series-disc', 'Endurance SL R Disc'], ['endurance-sl-r-series', 'Endurance SL R'],
  ['endurance-sl-r-disc', 'Endurance SL R Disc'], ['endurance-sl-r', 'Endurance SL R'],
  ['endurance-sl-disc', 'Endurance SL Disc'], ['endurance-sl', 'Endurance SL'],
  ['endurance-al-disc', 'Endurance AL Disc'], ['endurance-al', 'Endurance AL'],
  ['endurance-725-disc', 'Endurance 725 Disc'], ['endurance-725', 'Endurance 725'],
  ['endurance-ti-disc', 'Endurance Ti Disc'], ['endurance-ti', 'Endurance Ti'],
  ['r872-disc', 'R872 Disc'], ['r872', 'R872'], ['aero-883-disc', 'Aero 883 Disc'], ['aero-883', 'Aero 883'],
  ['ultra-sl-r', 'Ultra SL R'], ['ultra-sl', 'Ultra SL'], ['ultra-aero-sl', 'Ultra Aero SL'], ['ultra-race', 'Ultra Race'],
  ['ultra-road', 'Ultra-Road'], ['ultra-grit', 'Ultra-Grit'],
  ['allroad-sl-r', 'Allroad SL R'], ['allroad-sl', 'Allroad SL'], ['allroad-al', 'Allroad AL'], ['allroad-ti', 'Allroad Ti'],
  ['allroad-carbon', 'Allroad Carbon'], ['allgrit-al', 'Allgrit AL'], ['allgrit-ti-x', 'Allgrit Ti X'], ['allgrit-carbon-x', 'Allgrit Carbon X'],
  ['cgr-sl', 'CGR SL'], ['cgr-al', 'CGR AL'], ['cgr-725', 'CGR 725'], ['cgr-ti-x', 'CGR Ti X'], ['cgr-ti', 'CGR Ti'],
  ['cgr-carbon', 'CGR Carbon'], ['gravel-sl', 'Gravel SL'], ['gravel-al', 'Gravel AL'], ['gravel-725', 'Gravel 725'],
  ['gravel-ti', 'Gravel Ti'], ['cx-sl', 'CX SL'], ['cx', 'CX'],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

const NOT_A_BIKE = /(?:^|-)(?:e|sle|hanger|headset|forks?|seat-?post|seatclamp|clamp|axle|paint|wedge|guards?|mudguards?|bottle|cage|top-cap|stacker|kit|bar|stem|bolt|spacer|cups?|tyres?|wheelset|bag|rack|parts|accessories|tt|tri)(?:-|$)/;

function lineOf(url: string): { slug: string; line: [string, string] } | null {
  const m = url.replace(/[?#].*$/, '').match(/^https?:\/\/www\.ribblecycles\.co\.uk\/ribble-(?:20\d\d-)?([a-z0-9-]+)\/?$/);
  if (!m || NOT_A_BIKE.test(m[1])) return null;
  const line = LINES.find(([p]) => m[1] === p || m[1].startsWith(`${p}-`));
  return line ? { slug: m[1], line } : null;
}

/** Values in Nuxt's flattened payload (devalue): objects and arrays hold indices into the root array. */
function nuxtGeometry(html: string): string[][] | null {
  const raw = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return null;
  let root: unknown[];
  try {
    root = JSON.parse(raw);
  } catch {
    return null;
  }
  const at = (i: unknown): unknown => {
    const v = typeof i === 'number' ? root[i] : undefined;
    if (Array.isArray(v) && typeof v[0] === 'string' && /^(Reactive|ShallowReactive|Ref|ShallowRef)$/.test(v[0])) return at(v[1]);
    return v;
  };
  for (const o of root) {
    if (!o || typeof o !== 'object' || Array.isArray(o) || !('sizingGeometry' in o)) continue;
    const rows = at((o as Record<string, unknown>).sizingGeometry);
    if (!Array.isArray(rows)) continue;
    const keys = ['description', 'sizeOne', 'sizeTwo', 'sizeThree', 'sizeFour', 'sizeFive', 'sizeSix', 'sizeSeven', 'sizeEight'];
    const grid = rows.map((r) => {
      const row = at(r) as Record<string, unknown> | undefined;
      return keys.map((k) => (row && k in row ? String(at(row[k]) ?? '') : ''));
    });
    // Drop size columns that are empty in every row.
    const used = keys.map((_, c) => c === 0 || grid.slice(1).some((r) => r[c].trim()));
    return grid.map((r) => r.filter((_, c) => used[c]));
  }
  return null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// Ribble labels rows with the letters of its geometry drawing ("A - Seat Angle"; 2019 pages show only "A").
const LETTERS: Record<string, string> = {
  A: 'Seat Angle', C: 'Head Angle', E: 'Head Tube', F: 'BB Drop', G: 'Seat Tube', RC: 'Chainstay', WB: 'Wheelbase',
};
function label(s: string): string {
  const t = s.replace(/\(mm\)/i, '').trim();
  return LETTERS[t] ?? t.replace(/^[A-Z]{1,3}\s*-\s*/, '');
}
// Size labels vary between pages of one frame ("SM", "Small", "S").
const SIZES: Record<string, string> = {
  'extra extra small': 'XXS', 'extra small': 'XS', small: 'S', sm: 'S', medium: 'M', md: 'M', med: 'M', large: 'L', lg: 'L',
  lrg: 'L', 'x-large': 'XL', 'extra large': 'XL', 'xx-large': 'XXL', 'x-small': 'XS',
};
const sizeLabel = (s: string) => SIZES[s.toLowerCase()] ?? s.toUpperCase();
function tablesHtml(html: string): string {
  const $ = cheerio.load(html);
  $('tr').each((_, tr) => {
    const first = $(tr).children('td,th').first();
    first.text(label(first.text()));
  });
  return $.html();
}

const adapter: Adapter = {
  brand: 'Ribble',
  file: 'ribble',
  prefixes: ['www.ribblecycles.co.uk/ribble-'],
  seeds: [],
  accept(url) {
    const l = lineOf(url);
    if (!l) return null;
    return { url: url.replace(/[?#].*$/, '').replace(/^http:/, 'https:').replace(/\/?$/, '/'), family: l.line[1].toLowerCase().replace(/[^a-z0-9]+/g, '-') };
  },
  extract(page) {
    const l = lineOf(page.url);
    if (!l) return [];
    const nuxt = nuxtGeometry(page.html);
    const html = nuxt
      ? `<table>${nuxt.map((r) => `<tr>${r.map((c, i) => `<td>${esc(i ? c : label(c))}</td>`).join('')}</tr>`).join('')}</table>`
      : tablesHtml(page.html);
    const sizes: PartialSize[] | undefined = geometryTables(html).sort((a, b) => b.length - a.length)[0];
    if (!sizes) return [];
    const [key, model] = l.line;
    const category = categoryFrom(key, [
      [/^(aero|ultra-sl|ultra-aero)/, 'aero'], [/^(endurance|allroad|ultra-road)/, 'endurance'],
      [/^(cgr|gravel|allgrit|ultra-grit)/, 'gravel'], [/^cx/, 'cyclocross'],
    ], 'race');
    return [{ model, category, sizes: sizes.map((x) => ({ ...x, size: sizeLabel(x.size) })) }];
  },
};
export default adapter;
