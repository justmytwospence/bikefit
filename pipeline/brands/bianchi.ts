import * as cheerio from 'cheerio';
import type { FrameCategory, GeometryKey } from '../../src/data/schema';
import { parseValue } from '../lib/numbers';
import type { Adapter, PartialSize } from '../types';

// Bianchi labels columns with the letters of its frame drawing (misure-*.png): X reach, Y stack, G and G1 the angles.
const COLUMNS: Record<string, GeometryKey> = {
  A: 'seatTubeLength', C: 'chainstay', D: 'bbDrop', E: 'headTubeLength', G: 'seatTubeAngle', G1: 'headTubeAngle',
  X: 'reach', Y: 'stack', W: 'wheelbase', WB: 'wheelbase',
};

// Model key (product slug or shop path) to model name and category; first match wins.
const LINES: [RegExp, string, FrameCategory][] = [
  [/oltre-?xr4/, 'Oltre XR4', 'aero'],
  [/oltre-?xr3/, 'Oltre XR3', 'aero'],
  [/oltre-?(?:140th)?-?rc/, 'Oltre RC', 'aero'],
  [/oltre-?pro/, 'Oltre Pro', 'aero'],
  [/oltre-?comp/, 'Oltre Comp', 'aero'],
  [/oltre-?race/, 'Oltre Race', 'aero'],
  [/oltre/, 'Oltre', 'aero'],
  [/specialissima-pro-racing-team/, 'Specialissima', 'race'],
  [/specialissima-?(?:140th)?-?rc/, 'Specialissima RC', 'race'],
  [/specialissima-?pro/, 'Specialissima Pro', 'race'],
  [/specialissima-?comp/, 'Specialissima Comp', 'race'],
  [/specialissima/, 'Specialissima', 'race'],
  [/aria/, 'Aria', 'aero'],
  [/sprint/, 'Sprint', 'race'],
  [/infinito-?cv/, 'Infinito CV', 'endurance'],
  [/infinito-?xe/, 'Infinito XE', 'endurance'],
  [/paris-roubaix/, 'Infinito Paris-Roubaix', 'endurance'],
  [/infinito/, 'Infinito', 'endurance'],
  [/via-?nirone-?7/, 'Via Nirone 7', 'endurance'],
  [/impulso-?rc/, 'Impulso RC', 'gravel'],
  [/impulso-?pro/, 'Impulso Pro', 'gravel'],
  [/impulso-?comp/, 'Impulso Comp', 'gravel'],
  [/impulso-?allroad/, 'Impulso Allroad', 'gravel'],
  [/impulso/, 'Impulso', 'gravel'],
  [/arcadex-?al/, 'Arcadex AL', 'gravel'],
  [/arcadex/, 'Arcadex', 'gravel'],
  [/zolder/, 'Zolder Pro', 'cyclocross'],
];
const REJECT = /(?:^|[-/])e-|e-?road|e-?allroad|e-?gravel|tourer|tronik|omnia|spillo|methanol|nitron|magma|duel|c-sport|aquila|venezia|long-island|eroica|junior|active|mtb|city|pista/;

const STORE = /^https?:\/\/www\.bianchi\.com\/store\/int_EN\/(?:[xy][a-z]b[a-z0-9]{2,5}-)?([a-z0-9%&.-]+?)(?:-\d+)?\.html(?:[?#].*)?$/;
const SHOP = /^https?:\/\/www\.bianchi\.com\/(?:en\/)?shop\/bikes\/((?:road|gravel)\/[a-z0-9/-]+?)\/?(?:[?#].*)?$/;

/** The slug that names the model: the store product slug without its SKU, or the shop path below /bikes/. */
function keyOf(url: string): { key: string; canonical: string } | null {
  const s = url.match(STORE);
  if (s) return { key: decodeURIComponent(s[1]).toLowerCase().replace(/\s+/g, '-'), canonical: url.replace(/[?#].*$/, '').replace(/^http:/, 'https:') };
  const p = url.match(SHOP);
  if (p && p[1].split('/').length >= 4) return { key: p[1], canonical: url.replace(/[?#].*$/, '').replace(/^http:/, 'https:').replace(/\/?$/, '/') };
  return null;
}

function lineOf(key: string): [string, FrameCategory] | null {
  if (REJECT.test(key)) return null;
  // The build slug wins over the folders above it (/oltre/specialissima-rc/), unless its folder names the tier
  // it leaves out (/specialissima-comp-new/specialissima-2027/).
  const parts = key.split('/');
  const find = (s = '') => LINES.find(([re]) => re.test(s));
  const last = find(parts[parts.length - 1]);
  const parent = find(parts[parts.length - 2]);
  const hit = last && parent && parent[1].startsWith(`${last[1]} `) ? parent : last ?? find(key);
  return hit ? [hit[1], hit[2]] : null;
}

function sizesOf(html: string): PartialSize[] {
  const $ = cheerio.load(html);
  let best: PartialSize[] = [];
  $('table').each((_, t) => {
    const rows = $(t).find('tr').toArray().map((tr) => $(tr).children('td,th').toArray().map((c) => $(c).text().replace(/\s+/g, ' ').trim()));
    const h = rows.findIndex((r) => r.includes('X') && r.includes('Y'));
    if (h < 0) return;
    const head = rows[h].map((c) => c.toUpperCase());
    const out: PartialSize[] = [];
    for (const r of rows.slice(h + 1)) {
      const size = r[0] ?? '';
      if (!size || size.length > 6) continue;
      const s: PartialSize = { size };
      head.forEach((c, i) => {
        const key = i > 0 ? COLUMNS[c] : undefined;
        if (!key || s[key] !== undefined) return;
        const v = parseValue(key, r[i] ?? '');
        if (v !== null) s[key] = v;
      });
      if (s.stack !== undefined && s.reach !== undefined) out.push(s);
    }
    if (out.length > best.length) best = out;
  });
  return best;
}

const adapter: Adapter = {
  brand: 'Bianchi',
  file: 'bianchi',
  prefixes: ['www.bianchi.com/store/int_EN/', 'www.bianchi.com/shop/bikes/', 'www.bianchi.com/en/shop/bikes/'],
  seeds: [],
  accept(url) {
    const k = keyOf(url);
    if (!k || !lineOf(k.key)) return null;
    // Builds share a frame but not always the page layout (some show the geometry only as an image): keep each build.
    const family = k.key.split('/').pop()!.replace(/-\d+$/, '');
    return { url: k.canonical, family };
  },
  extract(page) {
    const k = keyOf(page.url);
    const line = k ? lineOf(k.key) : null;
    if (!line) return [];
    const sizes = sizesOf(page.html);
    if (sizes.length < 2) return [];
    return [{ model: line[0], category: line[1], sizes }];
  },
};
export default adapter;
