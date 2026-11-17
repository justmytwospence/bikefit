import * as cheerio from 'cheerio';
import { geometryTables } from '../lib/extract';
import type { FrameCategory } from '../../src/data/schema';
import type { Adapter } from '../types';

// Drop-bar frame families by URL slug (2022-24 /bike-product/detail/<Model>, 2024+ /products/<slug> and
// /premium-bikes/<slug>/technical-specifications). Before 2022 the site only linked PDF geometry sheets.
const LINES: [RegExp, string, FrameCategory][] = [
  [/^v5rs(-|$)/, 'V5Rs', 'aero'], [/^v4rs(-|$)/, 'V4Rs', 'aero'], [/^v3rs(-|$)/, 'V3Rs', 'race'],
  [/^v4(-|$)/, 'V4', 'race'], [/^v3(-|$)/, 'V3', 'race'], [/^y1rs(-|$)/, 'Y1Rs', 'aero'],
  [/^c72(-road)?(-|$)/, 'C72 Road', 'race'], [/^c68-allroad(-|$)/, 'C68 Allroad', 'endurance'],
  [/^c68-gravel(-|$)/, 'C68 Gravel', 'gravel'], [/^c68-(road-)?ti(tanium)?(-|$)/, 'C68 Road Ti', 'race'],
  [/^c68-rim(-|$)/, 'C68 Road Rim', 'race'], [/^c68(-road)?(-bike)?$/, 'C68 Road', 'race'],
  [/^g5-x(-|$)/, 'G5-X', 'gravel'], [/^g4-x(-|$)/, 'G4-X', 'gravel'], [/^g3-?x(-|$)/, 'G3-X', 'gravel'],
  [/^master(-|$)/, 'Master', 'race'], [/^steelnovo-bike$/, 'Steelnovo', 'race'], [/^a(ra)?besque(-|$)/, 'Arabesque', 'race'],
];
const NOT_A_FRAME = /(?:^|-)(?:clamp|cover|seatpost|headset|kit|plug|parts|bag|cage|hanger|axle|stem|bar|handlebars?|tape|jersey|shirt)(?:-|$)/;
const URL = /^https?:\/\/www\.colnago\.com\/(?:bike-product\/detail\/([A-Za-z0-9-]+)|(?:en|en-us)\/products\/([a-z0-9-]+)|(?:en|en-us)\/premium-bikes\/([a-z0-9-]+)\/technical-specifications)\/?$/;

function lineOf(url: string): { url: string; name: string; category: FrameCategory } | null {
  const u = url.replace(/[?#].*$/, '').replace(/^http:/, 'https:');
  const m = u.match(URL);
  if (!m) return null;
  const slug = (m[1] ?? m[2] ?? m[3]).toLowerCase();
  if (NOT_A_FRAME.test(slug)) return null;
  const line = LINES.find(([re]) => re.test(slug));
  return line ? { url: u.replace(/\/$/, ''), name: line[1], category: line[2] } : null;
}

// Colnago's symbols: Ss steering (head) angle, Sc seat angle, Hs head tube, C chainstay.
const LABELS: Record<string, string> = {
  stack: 'Stack', reach: 'Reach', hs: 'Head tube length', ss: 'Head tube angle', sc: 'Seat tube angle',
  c: 'Chainstay', bbdrop: 'BB drop', 'bb drop': 'BB drop',
};

function table(sizes: string[], rows: Record<string, string>[]): string {
  const keys = Object.keys(LABELS).filter((k) => rows.some((r) => r[k] !== undefined));
  const tr = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c.replace(/[<&]/g, '')}</td>`).join('')}</tr>`;
  return `<table>${tr(['Size', ...sizes])}${keys.map((k) => tr([LABELS[k], ...rows.map((r) => r[k] ?? '')])).join('')}</table>`;
}

/** 2022-24 pages: a jsonGeometry array keyed by the size select's option values. */
function fromJson(html: string): string | null {
  const raw = html.match(/var jsonGeometry = (\[[\s\S]*?\]);/)?.[1];
  if (!raw) return null;
  let data: Record<string, string>[];
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const $ = cheerio.load(html);
  const label = new Map($('select[name="geometryChange"] option').toArray().map((o) => [$(o).attr('value') ?? '', $(o).text().trim()]));
  // Some pages pair the size options with the wrong Ids (G3-X: Ids 208-218 against options 210-218); in order they match.
  const sizes = [...label.values()];
  const byOrder = data.length === sizes.length && !data.every((d) => label.has(String(d.Id)));
  const rows = byOrder ? data : data.filter((d) => label.has(String(d.Id)));
  const names = byOrder ? sizes : rows.map((r) => label.get(String(r.Id))!);
  const lower = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), String(v)])));
  return rows.length ? table(names, lower) : null;
}

/** 2024+ pages: one tab panel per size holding label/value paragraph pairs. */
function fromTabs(html: string): string | null {
  const $ = cheerio.load(html);
  const sizes: string[] = [];
  const rows: Record<string, string>[] = [];
  $('[role="tabpanel"][id^="tab-geometry-"]').each((_, panel) => {
    const size = $(panel).attr('id')!.split('-').pop()!;
    if (sizes.includes(size)) return;
    const ps = $(panel).find('p').toArray().map((p) => $(p).text().trim());
    const row: Record<string, string> = {};
    for (let i = 0; i + 1 < ps.length; i++) {
      const k = ps[i].toLowerCase().replace(/°/g, '').replace(/^virtual\s+/, '').trim();
      if (k in LABELS && row[k] === undefined) row[k] = ps[i + 1];
    }
    sizes.push(size);
    rows.push(row);
  });
  return sizes.length ? table(sizes, rows) : null;
}

const adapter: Adapter = {
  brand: 'Colnago',
  file: 'colnago',
  prefixes: [
    'www.colnago.com/bike-product/detail/', 'www.colnago.com/en-us/products/', 'www.colnago.com/en/products/',
    'www.colnago.com/en-us/premium-bikes/', 'www.colnago.com/en/premium-bikes/',
  ],
  seeds: [],
  accept(url) {
    const l = lineOf(url);
    return l ? { url: l.url, family: l.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') } : null;
  },
  extract(page) {
    const l = lineOf(page.url);
    if (!l) return [];
    const html = fromJson(page.html) ?? fromTabs(page.html);
    const sizes = html ? geometryTables(html)[0] : undefined;
    return sizes ? [{ model: l.name, category: l.category, sizes: sizes.map((x) => ({ ...x, size: x.size.toUpperCase() })) }] : [];
  },
};
export default adapter;
