import * as cheerio from 'cheerio';
import type { FrameCategory, GeometryKey } from '../../src/data/schema';
import { parseValue } from '../lib/numbers';
import type { Adapter, PartialSize } from '../types';

// Pinarello labels geometry columns with the letters of its drawing; CC (seat tube centre to centre) is the size name.
const COLUMNS: Record<string, GeometryKey> = {
  CC: 'seatTubeLength', A: 'seatTubeAngle', B: 'headTubeAngle', P: 'chainstay', T: 'headTubeLength', D: 'bbDrop',
  REACH: 'reach', STACK: 'stack',
};

// Line slug (after 'new-' and numeric suffixes) to model name and category; first match wins.
const LINES: [RegExp, string, FrameCategory][] = [
  [/^dogma-f10-?x-?light/, 'Dogma F10 X-Light', 'race'],
  [/^dogma-xlight-disk/, 'Dogma F12 X-Light Disk', 'race'],
  [/^dogma-xlight/, 'Dogma F12 X-Light', 'race'],
  [/^dogma-f12-disk/, 'Dogma F12 Disk', 'race'],
  [/^dogma-f12/, 'Dogma F12', 'race'],
  [/^dogma-f10-disks?$/, 'Dogma F10 Disk', 'race'],
  [/^dogma-f10x/, 'Dogma F10 X', 'race'],
  [/^dogma-f10/, 'Dogma F10', 'race'],
  [/^dogma-f8/, 'Dogma F8', 'race'],
  [/^dogma-f(-|$)/, 'Dogma F', 'race'],
  [/^dogma-k10s/, 'Dogma K10S Disk', 'endurance'],
  [/^dogma-k10/, 'Dogma K10', 'endurance'],
  [/^dogma-x(-|$)/, 'Dogma X', 'endurance'],
  [/^dogma-gr(-|$)/, 'Dogma GR', 'gravel'],
  [/^prince-fx-disk/, 'Prince FX Disk', 'race'],
  [/^prince-fx/, 'Prince FX', 'race'],
  [/^prince-disk/, 'Prince Disk', 'race'],
  [/^prince(-|$)/, 'Prince', 'race'],
  [/^gan-grs?-disk/, 'Gan GR', 'gravel'],
  [/^gan-k-disk/, 'Gan K Disk', 'endurance'],
  [/^gan-disk/, 'Gan Disk', 'race'],
  [/^gan-rs/, 'Gan RS', 'race'],
  [/^gan-s(-|$)/, 'Gan S', 'race'],
  [/^gan(-|$)/, 'Gan', 'race'],
  [/^paris(-|$)/, 'Paris', 'race'],
  [/^angliru-disk/, 'Angliru Disk', 'endurance'],
  [/^angliru/, 'Angliru', 'endurance'],
  [/^razha-disk/, 'Razha Disk', 'endurance'],
  [/^razha/, 'Razha', 'endurance'],
  [/^neor/, 'Neor', 'race'],
  [/^prima/, 'Prima', 'race'],
  [/^mercurio/, 'Mercurio Disk', 'endurance'],
  [/^pinarello-f(-|$)/, 'F', 'race'],
  [/^pinarello-x(-|$)/, 'X', 'endurance'],
  [/^grevil-mx/, 'Grevil MX', 'gravel'],
  [/^grevil-f(-|$)/, 'Grevil F', 'gravel'],
  [/^grevil(-|$)/, 'Grevil', 'gravel'],
  [/^granger-x/, 'Granger X', 'gravel'],
  [/^crossista/, 'Crossista', 'cyclocross'],
  [/^fcx/, 'FCX', 'cyclocross'],
];
const REJECT = /nytro|bolide|maat|dogma-?fs|e-road|e-gravel|treviso|xc-series|dogma-xc/;

const OLD = /^https?:\/\/(?:www\.)?pinarello\.com(?::80)?\/en\/(bike-2018|bikes-2019|bikes-2020)\/(road|gravel|cross)\/([a-z0-9_-]+)\/?(?:[?#].*)?$/;
const NEW = /^https?:\/\/(?:www\.)?pinarello\.com\/global\/en\/bikes\/(road|gravel)\/([a-z-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)\/?(?:[?#].*)?$/;

/** The line slug with 'new-', year, edition and numeric suffixes removed. */
const lineSlug = (s: string) => s.replace(/^new-/, '').replace(/-(?:20\d\d|201|edizione-speciale|1k)$/, '').replace(/(?:-\d{1,2})+$/, '');

function lineOf(slug: string): [string, FrameCategory] | null {
  const s = lineSlug(slug);
  if (REJECT.test(s)) return null;
  const hit = LINES.find(([re]) => re.test(s));
  return hit ? [hit[1], hit[2]] : null;
}

/** The model line a page belongs to: old site '/<year>/<type>/<line>', new site '/bikes/<type>/<group>/<line>/<build>'. */
function lineFromUrl(url: string): string | null {
  const o = url.match(OLD);
  if (o) return o[3].replace(/_/g, '-');
  const n = url.match(NEW);
  if (!n) return null;
  // A build under another line's page (Grevil MX under new-grevil-f) names its own line.
  return /^grevil-mx/.test(n[4]) ? n[4] : n[3];
}

/** Size blocks of the geometry table: the main one first, then any titled block (for example 'EASYFIT'). */
function blocksOf(html: string): { title: string; sizes: PartialSize[] }[] {
  const $ = cheerio.load(html);
  let best: { title: string; sizes: PartialSize[] }[] = [];
  $('table').each((_, t) => {
    const rows = $(t).find('tr').toArray().map((tr) => $(tr).children('td,th').toArray().map((c) => $(c).text().replace(/\s+/g, ' ').trim()));
    if (rows.length < 3) return;
    const head = rows[0].map((h) => h.replace(/\[.*?\]/g, '').trim().toUpperCase());
    const cc = head.indexOf('CC');
    if (cc < 0 || !head.includes('STACK') || !head.includes('REACH')) return;
    const blocks = [{ title: '', sizes: [] as PartialSize[] }];
    for (const r of rows.slice(1)) {
      if (!/\d/.test(r[0] ?? '') && r.slice(1).every((c) => !c)) {
        blocks.push({ title: r[0], sizes: [] });
        continue;
      }
      const size = String(Math.round(Number(r[cc])));
      if (!/^\d{3}$/.test(size)) continue;
      const s: PartialSize = { size };
      head.forEach((h, i) => {
        const key = COLUMNS[h];
        if (!key || s[key] !== undefined) return;
        const v = parseValue(key, r[i] ?? '');
        if (v !== null) s[key] = v;
      });
      if (s.stack !== undefined && s.reach !== undefined) blocks[blocks.length - 1].sizes.push(s);
    }
    const kept = blocks.filter((b) => b.sizes.length >= 2);
    if ((kept[0]?.sizes.length ?? 0) > (best[0]?.sizes.length ?? 0)) best = kept;
  });
  return best;
}

const adapter: Adapter = {
  brand: 'Pinarello',
  file: 'pinarello',
  prefixes: [
    'pinarello.com/global/en/bikes/road/', 'pinarello.com/global/en/bikes/gravel/',
    'pinarello.com/en/bike-2018/', 'pinarello.com/en/bikes-2019/', 'pinarello.com/en/bikes-2020/',
  ],
  seeds: [],
  accept(url) {
    const line = lineFromUrl(url);
    if (!line) return null;
    const n = url.match(NEW);
    if (n && /nytro|e-bike|supercharged/.test(n[2] + n[4])) return null;
    if (!lineOf(line)) return null;
    const clean = url.replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^http:\/\//, 'https://').replace(/:80\//, '/');
    const canonical = clean.replace(/^https:\/\/pinarello\.com\/en\//, 'https://www.pinarello.com/en/');
    // 'new-' marks a new frame under an old name (new-dogma-f): keep it apart so each gets its own capture per period.
    return { url: canonical, family: (/\/new-/.test(clean) ? 'new-' : '') + lineSlug(line) };
  },
  extract(page) {
    const line = lineFromUrl(page.url);
    const hit = line ? lineOf(line) : null;
    if (!hit) return [];
    // The old site names the model year in the path (/en/bikes-2019/).
    const year = Number(page.url.match(OLD)?.[1].slice(-4)) || undefined;
    // A titled block is a second geometry for the same frame (Easyfit: taller and shorter).
    return blocksOf(page.html).map((b) => {
      const title = b.title.replace(/\s+/g, '').toLowerCase();
      return title
        ? { model: `${hit[0]} ${title.charAt(0).toUpperCase()}${title.slice(1)}`, year, category: 'endurance' as const, sizes: b.sizes }
        : { model: hit[0], year, category: hit[1], sizes: b.sizes };
    });
  },
};
export default adapter;
