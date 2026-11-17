import * as cheerio from 'cheerio';
import type { GeometryKey } from '../../src/data/schema';
import type { PartialSize } from '../types';
import { keyFor } from './labels';
import { parseValue } from './numbers';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function grid($: cheerio.CheerioAPI, table: Parameters<cheerio.CheerioAPI>[0]): string[][] {
  const g: string[][] = [];
  $(table).find('tr').each((r, tr) => {
    g[r] ??= [];
    let c = 0;
    $(tr).children('td,th').each((_, cell) => {
      while (g[r][c] !== undefined) c++;
      const text = clean($(cell).text());
      const cs = Math.max(1, Number($(cell).attr('colspan')) || 1);
      const rs = Math.max(1, Number($(cell).attr('rowspan')) || 1);
      for (let i = 0; i < rs; i++) {
        g[r + i] ??= [];
        for (let j = 0; j < cs; j++) g[r + i][c + j] = text;
      }
      c += cs;
    });
  });
  return g.map((row) => Array.from(row, (x) => x ?? ''));
}

function fromGrid(g: string[][]): PartialSize[] | null {
  if (g.length < 3) return null;
  const col0 = g.slice(1).filter((row) => keyFor(row[0] ?? '')).length;
  const row0 = (g[0] ?? []).slice(1).filter((c) => keyFor(c)).length;
  const rowsAreLabels = col0 >= 4 && col0 >= row0;
  const cols = rowsAreLabels ? g : g[0].map((_, c) => g.map((row) => row[c] ?? ''));
  if (!rowsAreLabels && row0 < 4) return null;
  const sizes: PartialSize[] = [];
  const width = Math.max(...cols.map((r) => r.length));
  for (let c = 1; c < width; c++) {
    const size = clean(cols[0][c] ?? '');
    if (size) sizes.push({ size });
    else sizes.push({ size: '' });
  }
  const seen = new Set<GeometryKey>();
  for (const row of cols.slice(1)) {
    const key = keyFor(row[0] ?? '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    sizes.forEach((s, i) => {
      const v = parseValue(key, row[i + 1] ?? '', row[0]);
      if (v !== null) s[key] = v;
    });
  }
  const out = sizes.filter((s) => s.size && s.stack !== undefined && s.reach !== undefined);
  return out.length >= 2 ? out : null;
}

/** One size list per table whose labels map to geometry keys, in either orientation. */
export function geometryTables(html: string): PartialSize[][] {
  const $ = cheerio.load(html);
  const out: PartialSize[][] = [];
  $('table').each((_, t) => {
    const s = fromGrid(grid($, t));
    if (s) out.push(s);
  });
  return out;
}

type Json = unknown;
function walk(x: Json, f: (o: Record<string, Json>) => void) {
  if (Array.isArray(x)) x.forEach((y) => walk(y, f));
  else if (x && typeof x === 'object') {
    f(x as Record<string, Json>);
    Object.values(x as Record<string, Json>).forEach((y) => walk(y, f));
  }
}

/** Sizes from schema.org products carrying PropertyValue geometry (Canyon). One entry per size label. */
export function jsonLdSizes(html: string): PartialSize[] {
  const $ = cheerio.load(html);
  const bySize = new Map<string, PartialSize>();
  $('script[type="application/ld+json"]').each((_, el) => {
    let data: Json;
    try {
      data = JSON.parse($(el).text());
    } catch {
      return;
    }
    walk(data, (o) => {
      const props = o.additionalProperty;
      if (!Array.isArray(props)) return;
      const name = typeof o.name === 'string' ? o.name : '';
      const label = clean(String(o.size ?? name.split(' | ').pop() ?? name.split(' - ').pop() ?? ''));
      if (!label) return;
      const s: PartialSize = bySize.get(label) ?? { size: label };
      for (const p of props as Record<string, Json>[]) {
        const key = keyFor(String(p.name ?? ''));
        if (!key || s[key] !== undefined) continue;
        const v = parseValue(key, `${p.value ?? ''} ${p.unitText ?? ''}`);
        if (v !== null) s[key] = v;
      }
      if (s.stack !== undefined && s.reach !== undefined) bySize.set(label, s);
    });
  });
  return [...bySize.values()];
}

const BUILD_WORDS = [
  'di2', 'axs', 'etap', 'frameset', 'framekit', 'frame', 'kit', 'disc', 'rim', 'ultegra', 'dura-ace', 'dura', 'ace', '105',
  'rival', 'force', 'red', 'apex', 'grx', 'sram', 'shimano', 'campagnolo', 'record', 'chorus', 'potenza', 'ekar',
  'carbon', 'wmn', 'comp', 'expert', 'pro', 'sport', 'elite', 'team', 'launch', 'edition', 'limited', 'hydro', 'mechanical', 'electronic',
];

/** A page title cut down to the model: drops trailing build words, bare numbers, '|' and '-' suffixes. */
export function familyName(title: string, words: string[] = []): string {
  const stop = new Set([...BUILD_WORDS, ...words.map((w) => w.toLowerCase())]);
  const base = title.split(/\s[|–—]\s|\s-\s/)[0].replace(/\s+/g, ' ').trim();
  const parts = base.split(' ');
  while (parts.length > 1) {
    const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (stop.has(last) || /^\d$/.test(last) || last === '') parts.pop();
    else break;
  }
  return parts.join(' ');
}
