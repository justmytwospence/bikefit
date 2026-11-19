import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter, PartialSize } from '../types';

// Norco's drop-bar range from model year 2018: Search (gravel), Section (all-road), Threshold (cyclocross), Valence
// (endurance) and Tactic (road race). Three page templates carry the geometry:
// - 2018, norco.com/bikes/road/<category>/<family>/<model>/: <table class="geoTable">, a letter column (class geoID)
//   ahead of the label and a header cell spanning both;
// - model years 2018 to 2021, norco.com/bikes/<year>/<section>/...: <table class="geometry-table"> per wheel size, each
//   cell twice (desktop and mobile);
// - from 2021 on, norco.com/bikes/road/<category>/<family>/<year>-<model>/: JSON in an inline script
//   (const contents = {...geometry: {geo_table: {head, rows}}}).
const LINES = ['search', 'section', 'threshold', 'valence', 'tactic'];
const CATEGORIES: [RegExp, FrameCategory][] = [[/^threshold/, 'cyclocross'], [/^valence/, 'endurance'], [/^tactic/, 'race']];

// <section>/<category>/<family dir>/<model>, with the model year's section in 2018-2021 pages.
const URL_RE = /^https?:\/\/(?:www\.)?norco\.com(?::\d+)?(\/bikes\/(?:(20(?:1[89]|2[01]))\/(?:pavement|dirt-dropbar|road)|road)\/[a-z-]+\/([a-z0-9-]+)\/([a-z0-9-]+)\/?)(?:[?#].*)?$/;
// Women's, kids', flat-bar and the 24 inch and 650c youth builds of these lines.
const EXCLUDED = /(?:^|-)(?:womens?|forma|kids?|youth|inch|24|650c?|flat-?bar|fb\d?)(?:-|$)/;

const material = (t: string) =>
  /^(?:carbon|c\d?)$/.test(t) ? 'Carbon' : /^(?:aluminum|alu|alloy|a\d?)$/.test(t) ? 'Aluminum' : /^(?:steel|s\d?)$/.test(t) ? 'Steel' : null;

interface Frame { model: string; category: FrameCategory; family: string }

/**
 * The frame a product slug belongs to. Builds of one frame share a name: 'Search XR Carbon' for Apex 1, Force 1 and the
 * frame/fork. The family directory changed over the years (search-alu, search-aluminum, search) and a few 2018 pages sit
 * in another frame's directory, so the slug decides and the directory supplies what it leaves out (the material).
 */
function frameOf(dir: string, slug: string): Frame | null {
  const bare = slug.replace(/^(?:20)?\d\d-/, '');
  const d = dir.replace(/^(?:20)?\d\d-/, '');
  const line = LINES.find((l) => bare === l || bare.startsWith(`${l}-`));
  if (!line || d.split('-')[0] !== line || EXCLUDED.test(bare) || EXCLUDED.test(d)) return null;
  const tokens = bare.split('-').slice(1);
  const dirTokens = d.split('-').slice(1);
  const xr = tokens[0] === 'xr' || tokens[0] === 'xrs';
  const rest = xr ? tokens.slice(1) : tokens;
  const mat = tokens[0] === 'xrs' ? 'Steel' : (rest.map(material).find(Boolean) ?? dirTokens.map(material).find(Boolean) ?? null);
  const has = (w: string) => tokens.includes(w) || dirTokens.includes(w);
  let model: string;
  if (line === 'tactic') {
    model = has('slr') ? 'Tactic SLR' : has('sl') ? (has('disc') ? 'Tactic SL Disc' : 'Tactic SL') : 'Tactic';
  } else if (!mat) {
    return null;
  } else if (line === 'search') {
    model = `Search${xr ? ' XR' : ''} ${mat}${tokens.includes('suspension') ? ' Suspension' : ''}`;
  } else if (line === 'valence') {
    model = `Valence${has('sl') ? ' SL' : ''}${has('disc') ? ' Disc' : ''} ${mat}`;
  } else {
    model = `${line[0].toUpperCase()}${line.slice(1)} ${mat}`;
  }
  return { model, category: categoryFrom(line, CATEGORIES, 'gravel'), family: model.toLowerCase().replace(/ /g, '-') };
}

/** The model year in a product URL: the year section, or the slug's '2021-' or '25-' prefix. */
function yearIn(section: string | undefined, dir: string, slug: string): number {
  if (section) return Number(section);
  const p = (slug.match(/^(\d\d)(\d\d)?-/) ?? dir.match(/^(\d\d)(\d\d)?-/));
  if (!p) return 2018;
  return p[2] ? Number(p[1] + p[2]) : 2000 + Number(p[1]);
}

function parse(url: string): (Frame & { url: string }) | null {
  const m = url.match(URL_RE);
  if (!m || /[?&]bike-404/.test(url)) return null;
  const frame = frameOf(m[3], m[4]);
  if (!frame) return null;
  return { ...frame, url: `https://www.norco.com${m[1]}`, family: `${frame.family}@${yearIn(m[2], m[3], m[4])}` };
}

/** The object literal after `const contents =`, found by matching braces outside strings. */
function contentsJson(html: string): unknown {
  const at = html.search(/const\s+contents\s*=\s*\{/);
  if (at < 0) return null;
  const start = html.indexOf('{', at);
  let depth = 0;
  let quoted = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (c === '\\') i++;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// 'Bottom Bracket Rise/Drop:' is not a label the catalog knows; the value is a drop (negative) or a rise.
const label = (s: string) => (/rise\s*\/\s*drop/i.test(s) ? 'BB Drop' : s);

/** The JSON era's size table as markup, so the table reader sees it as in the other eras. */
function jsonTable(html: string): string {
  const table = (contentsJson(html) as { geometry?: { geo_table?: { head?: { values?: string[] }[]; rows?: { field?: string; values?: string[] }[] } } } | null)
    ?.geometry?.geo_table;
  const sizes = table?.head?.[0]?.values;
  if (!sizes?.length || !table?.rows) return '';
  const row = (cells: string[]) => `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`;
  return `<table>${row(['', ...sizes])}${table.rows.map((r) => row([label(r.field ?? ''), ...(r.values ?? [])])).join('')}</table>`;
}

const adapter: Adapter = {
  brand: 'Norco',
  file: 'norco',
  // Only the sections that hold drop-bar bikes (the 2018 to 2021 'pavement' section also holds hybrids and city bikes).
  prefixes: [
    'norco.com/bikes/road/',
    'norco.com/bikes/2018/dirt-dropbar/', 'norco.com/bikes/2018/pavement/endurance/', 'norco.com/bikes/2018/pavement/road-race/',
    'norco.com/bikes/2019/dirt-dropbar/', 'norco.com/bikes/2019/pavement/endurance/', 'norco.com/bikes/2019/pavement/road-race/',
    'norco.com/bikes/2019/pavement/all-road/', 'norco.com/bikes/2019/road/',
    'norco.com/bikes/2020/dirt-dropbar/', 'norco.com/bikes/2020/pavement/all-road/', 'norco.com/bikes/2020/road/',
    'norco.com/bikes/2021/road/',
  ],
  seeds: [],
  accept(url) {
    const p = parse(url);
    return p && { url: p.url, family: p.family };
  },
  extract(page) {
    const frame = parse(page.url);
    if (!frame) return [];
    const $ = cheerio.load(page.html);
    // Drop the drawing's letter column and the mobile copy of each cell, and the header's two-column span.
    $('td.geoID, td.d-md-none').remove();
    $('th[colspan]').removeAttr('colspan');
    $('table.geoTable td.geoName, table.geometry-table td.text-bold').each((_, td) => void $(td).text(label($(td).text())));
    // Larger wheel sizes sit in a table of their own (650b, 700c); each size once.
    const sizes: PartialSize[] = [];
    const tables = [...$('table.geoTable, table.geometry-table').toArray().map((t) => $.html(t)), jsonTable(page.html)];
    for (const t of tables.filter(Boolean)) {
      for (const s of geometryTables(t).flat()) if (!sizes.some((x) => x.size === s.size)) sizes.push(s);
    }
    if (sizes.length < 2) return [];
    // 'Search XR C1 2021 | Norco Bicycles' and '2022 Search XR C | Norco' state the model year; 2018 pages and the
    // live site's titles do not.
    const year = Number($('title').text().match(/\b(20(?:1[89]|2\d))\b/)?.[1]) || undefined;
    return [{ model: frame.model, year, category: frame.category, sizes }];
  },
};
export default adapter;
