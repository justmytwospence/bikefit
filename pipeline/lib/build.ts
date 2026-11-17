import { GEOMETRY_KEYS, RANGES, slug, type BrandFile, type FrameCategory, type GeometryKey, type SizeRow } from '../../src/data/schema';
import type { Adapter, Extracted, Manifest, Overrides, Page } from '../types';

type Model = BrandFile['models'][number];
export type Fill = (category: FrameCategory, key: GeometryKey, stack: number) => number;

const OPTIONAL: GeometryKey[] = ['headTubeLength', 'seatTubeLength', 'chainstay', 'wheelbase', 'bbDrop'];
const REQUIRED: GeometryKey[] = ['stack', 'reach', 'seatTubeAngle', 'headTubeAngle'];

export const pageKey = (url: string, timestamp: string) => `${url}@${timestamp}`;
const stripUrl = (u: string) => u.replace(/[?#].*$/, '').replace(/\/+$/, '');
const dateOf = (ts: string) => `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
const cmp = (a: string, b: string) => a.localeCompare(b, 'en');

/** Used before real estimates exist: the middle of each plausible range. */
export const midFill: Fill = (_c, key) => Math.round((RANGES[key][0] + RANGES[key][1]) / 2);

interface Cand {
  model: string;
  year: number;
  category: FrameCategory;
  tyreWidth?: number;
  maxSpacers?: number;
  aliases?: string[];
  rows: SizeRow[];
  estimated: GeometryKey[];
  source: string;
  timestamp: string;
}

function clean(e: Extracted, fill: Fill, log: (s: string) => void): { rows: SizeRow[]; estimated: GeometryKey[] } | null {
  const est = new Set<GeometryKey>();
  const rows: SizeRow[] = [];
  for (const s of e.sizes) {
    if (REQUIRED.some((k) => s[k] === undefined || s[k]! < RANGES[k][0] || s[k]! > RANGES[k][1])) continue;
    const nums = GEOMETRY_KEYS.map((k) => {
      const v = s[k];
      if (v !== undefined && v >= RANGES[k][0] && v <= RANGES[k][1]) return v;
      est.add(k);
      return Math.min(RANGES[k][1], Math.max(RANGES[k][0], fill(e.category, k, s.stack!)));
    });
    rows.push([s.size, ...nums]);
  }
  if (rows.length < 2) return null;
  rows.sort((a, b) => (a[1] as number) - (b[1] as number) || (a[2] as number) - (b[2] as number) || cmp(a[0], b[0]));
  if (new Set(rows.map((r) => r[0])).size !== rows.length) {
    log(`dropped (duplicate size labels): ${e.model}`);
    return null;
  }
  // A size whose reach falls well below a smaller size's is a typo in the source; drop it.
  let maxReach = 0;
  for (let i = 0; i < rows.length; i++) {
    const reach = rows[i][2] as number;
    if (reach < maxReach - 10) {
      log(`dropped size ${rows[i][0]} (reach drops with size): ${e.model}`);
      rows.splice(i--, 1);
    } else maxReach = Math.max(maxReach, reach);
  }
  if (rows.length < 2 || (rows[rows.length - 1][2] as number) <= (rows[0][2] as number)) return null;
  return { rows, estimated: OPTIONAL.filter((k) => est.has(k)) };
}

export function buildBrand(
  adapter: Adapter, manifest: Manifest, pages: Map<string, Page>, overrides: Overrides, fill: Fill,
  log: (s: string) => void = () => {},
): BrandFile {
  const cands: Cand[] = [];
  for (const entry of manifest.pages) {
    if (overrides.exclude.includes(entry.url)) continue;
    const page = pages.get(pageKey(entry.url, entry.timestamp));
    if (!page) continue;
    for (const e of adapter.extract(page)) {
      const fix = overrides.models[e.model] ?? {};
      if (fix.drop) continue;
      const model = fix.model ?? e.model;
      const category = fix.category ?? e.category;
      const c = clean({ ...e, model, category }, fill, log);
      if (!c) continue;
      cands.push({
        model, category, year: e.year ?? entry.year, tyreWidth: fix.tyreWidth ?? e.tyreWidth, maxSpacers: fix.maxSpacers,
        aliases: fix.aliases ?? e.aliases, rows: c.rows, estimated: c.estimated, source: entry.url, timestamp: entry.timestamp,
      });
    }
  }
  // Identical geometry across years becomes one model with a year range.
  const merged = new Map<string, Model>();
  for (const c of cands.sort((a, b) => a.year - b.year || cmp(a.source, b.source) || cmp(a.model, b.model))) {
    const k = `${c.model}\u0000${JSON.stringify(c.rows)}`;
    const have = merged.get(k);
    if (!have) {
      merged.set(k, {
        model: c.model, year: c.year, lastYear: c.year, category: c.category, source: c.source,
        retrieved: dateOf(c.timestamp), archive: `https://web.archive.org/web/${c.timestamp}/${c.source}`,
        aliases: c.aliases, tyreWidth: c.tyreWidth, maxSpacers: c.maxSpacers,
        estimated: c.estimated.length ? c.estimated : undefined, sizes: c.rows,
      });
    } else if (c.year >= have.lastYear!) {
      have.lastYear = c.year;
      have.source = c.source;
      have.retrieved = dateOf(c.timestamp);
      have.archive = `https://web.archive.org/web/${c.timestamp}/${c.source}`;
    }
  }
  // One entry per model and first year.
  const byId = new Map<string, Model>();
  for (const m of [...merged.values()].sort((a, b) => cmp(a.source, b.source))) {
    const id = `${slug(m.model)}-${m.year}`;
    if (byId.has(id)) log(`duplicate: ${manifest.brand} ${m.model} ${m.year} ${m.source}`);
    else byId.set(id, m);
  }
  const sources = new Set([...byId.values()].map((m) => stripUrl(m.source)));
  const extracted = [...byId.values()];
  for (const m of overrides.manual) {
    const id = `${slug(m.model)}-${m.year}`;
    if (sources.has(stripUrl(m.source)) || byId.has(id)) continue;
    // A hand-entered model is redundant when a page-derived one of the same name covers its years.
    const last = m.lastYear ?? m.year;
    if (extracted.some((x) => slug(x.model) === slug(m.model) && x.year <= last && (x.lastYear ?? x.year) >= m.year)) continue;
    byId.set(id, m);
  }
  const models = [...byId.values()].sort((a, b) => cmp(a.model, b.model) || a.year - b.year);
  return { brand: manifest.brand, models };
}

/** Least-squares line on stack per category and key over measured (not estimated) values. */
export function fitEstimates(files: BrandFile[]): Fill {
  type Pts = { x: number[]; y: number[] };
  const pts = new Map<string, Pts>();
  const all = new Map<GeometryKey, number[]>();
  for (const f of files) {
    for (const m of f.models) {
      for (const r of m.sizes) {
        for (const k of OPTIONAL) {
          if (m.estimated?.includes(k)) continue;
          const i = GEOMETRY_KEYS.indexOf(k) + 1;
          const key = `${m.category}|${k}`;
          const p = pts.get(key) ?? { x: [], y: [] };
          p.x.push(r[1] as number);
          p.y.push(r[i] as number);
          pts.set(key, p);
          (all.get(k) ?? all.set(k, []).get(k)!).push(r[i] as number);
        }
      }
    }
  }
  const median = (a: number[]) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
  return (category, key, stack) => {
    const p = pts.get(`${category}|${key}`);
    if (!p || p.x.length < 20) return all.get(key)?.length ? median(all.get(key)!) : midFill(category, key, stack);
    const n = p.x.length;
    const mx = p.x.reduce((s, v) => s + v, 0) / n;
    const my = p.y.reduce((s, v) => s + v, 0) / n;
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < n; i++) {
      sxx += (p.x[i] - mx) ** 2;
      sxy += (p.x[i] - mx) * (p.y[i] - my);
    }
    const b = sxx ? sxy / sxx : 0;
    return Math.round(my + b * (stack - mx));
  };
}

const j = (v: unknown) => JSON.stringify(v);

/** Stable text: 2-space JSON with each size tuple on its own line. */
export function formatBrand(f: BrandFile): string {
  const models = f.models.map((m) => {
    const lines: string[] = [
      `      "model": ${j(m.model)}`, `      "year": ${m.year}`,
    ];
    if (m.lastYear && m.lastYear > m.year) lines.push(`      "lastYear": ${m.lastYear}`);
    lines.push(`      "category": ${j(m.category)}`, `      "source": ${j(m.source)}`, `      "retrieved": ${j(m.retrieved)}`);
    if (m.archive) lines.push(`      "archive": ${j(m.archive)}`);
    if (m.aliases?.length) lines.push(`      "aliases": ${j(m.aliases)}`);
    if (m.tyreWidth !== undefined) lines.push(`      "tyreWidth": ${m.tyreWidth}`);
    if (m.maxSpacers !== undefined) lines.push(`      "maxSpacers": ${m.maxSpacers}`);
    if (m.estimated?.length) lines.push(`      "estimated": ${j(m.estimated)}`);
    lines.push(`      "sizes": [\n${m.sizes.map((r) => `        ${j(r)}`).join(',\n')}\n      ]`);
    return `    {\n${lines.join(',\n')}\n    }`;
  });
  return `{\n  "brand": ${j(f.brand)},\n  "models": [\n${models.join(',\n')}\n  ]\n}\n`;
}
