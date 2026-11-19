import { GEOMETRY_KEYS, RANGES, slug, type BrandFile, type FrameCategory, type GeometryKey, type SizeRow } from '../../src/data/schema';
import type { Adapter, Extracted, Manifest, Overrides, Page } from '../types';

type Model = BrandFile['models'][number];
export type Fill = (category: FrameCategory, key: GeometryKey, stack: number) => number;

const OPTIONAL: GeometryKey[] = ['headTubeLength', 'seatTubeLength', 'chainstay', 'wheelbase', 'bbDrop'];
const REQUIRED: GeometryKey[] = ['stack', 'reach', 'seatTubeAngle', 'headTubeAngle'];
/** The catalog starts here: pages that state an older model year are dropped. */
export const MIN_YEAR = 2018;

export const pageKey = (url: string, timestamp: string) => `${url}@${timestamp}`;
const stripUrl = (u: string) => u.replace(/[?#].*$/, '').replace(/\/+$/, '');
const dateOf = (ts: string) => `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
const cmp = (a: string, b: string) => a.localeCompare(b, 'en');

/** Used before real estimates exist: the middle of each plausible range. */
export const midFill: Fill = (_c, key) => Math.round((RANGES[key][0] + RANGES[key][1]) / 2);

/** One frame as the catalog will list it, with how many pages back it. */
interface Entry {
  model: string;
  year: number;
  lastYear: number;
  category: FrameCategory;
  tyreWidth?: number;
  maxSpacers?: number;
  aliases: string[];
  rows: SizeRow[];
  estimated: GeometryKey[];
  source: string;
  retrieved: string;
  archive?: string;
  pages: number;
}

const byStack = (a: SizeRow, b: SizeRow) =>
  (a[1] as number) - (b[1] as number) || (a[2] as number) - (b[2] as number) || cmp(a[0], b[0]);

function clean(e: Extracted, fill: Fill, log: (s: string) => void): { rows: SizeRow[]; estimated: GeometryKey[] } | null {
  const est = new Set<GeometryKey>();
  let rows: SizeRow[] = [];
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
  rows.sort(byStack);
  if (new Set(rows.map((r) => r[0])).size !== rows.length) {
    log(`dropped (duplicate size labels): ${e.model}`);
    return null;
  }
  // A size whose reach falls well below a smaller size's is a typo or a stray row in the source. Drop the fewest
  // rows that leave reach in order: the longest run in which no size is more than 10 mm shorter than the one before.
  const best = rows.map(() => 1);
  const prev = rows.map(() => -1);
  for (let i = 1; i < rows.length; i++) {
    for (let k = 0; k < i; k++) {
      if ((rows[i][2] as number) >= (rows[k][2] as number) - 10 && best[k] + 1 > best[i]) {
        best[i] = best[k] + 1;
        prev[i] = k;
      }
    }
  }
  let end = 0;
  for (let i = 1; i < rows.length; i++) if (best[i] > best[end]) end = i;
  const keep = new Set<number>();
  for (let i = end; i >= 0; i = prev[i]) keep.add(i);
  rows.forEach((r, i) => {
    if (!keep.has(i)) log(`dropped size ${r[0]} (reach out of order): ${e.model}`);
  });
  rows = rows.filter((_, i) => keep.has(i));
  if (rows.length < 2 || (rows[rows.length - 1][2] as number) <= (rows[0][2] as number)) return null;
  return { rows, estimated: OPTIONAL.filter((k) => est.has(k)) };
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const related = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return x === y || x.startsWith(y + ' ') || y.startsWith(x + ' ');
};
const GENERATION = /\b(gen ?\d+|sl ?\d+|mk ?\d+|v\d+)\b/;
/** The generation a name states ('Gen 4', 'SL7', 'Mk2', 'V3'), or '' when it states none. */
const generation = (name: string) => norm(name).match(GENERATION)?.[1].replace(' ', '') ?? '';
/** The name without its generation, and the generation's number: 'Checkpoint SL Gen 2' is 'checkpoint sl', 2. */
const line = (name: string) => norm(name).replace(GENERATION, ' ').replace(/\s+/g, ' ').trim();
const generationNumber = (name: string) => Number(generation(name).match(/\d+/)?.[0] ?? 0);
const tolerance = (k: GeometryKey) => (k === 'seatTubeAngle' || k === 'headTubeAngle' ? 0.3 : 2) + 1e-9;

/**
 * The same frame: one size list holds the other's labels, and on the shared sizes every value both measured
 * agrees within 2 mm or 0.3 degrees. Values either side estimated say nothing. With four or more shared sizes,
 * one of them may disagree: makers correct a typo in one row, and no two frames differ in a single size.
 */
function sameFrame(a: Pick<Entry, 'rows' | 'estimated'>, b: Pick<Entry, 'rows' | 'estimated'>): boolean {
  const other = new Map(b.rows.map((r) => [r[0], r]));
  const shared = a.rows.filter((r) => other.has(r[0]));
  if (shared.length < 2 || shared.length < Math.min(a.rows.length, b.rows.length)) return false;
  const off = shared.filter((r) => GEOMETRY_KEYS.some((k, i) =>
    !a.estimated.includes(k) && !b.estimated.includes(k)
    && Math.abs((r[i + 1] as number) - (other.get(r[0])![i + 1] as number)) > tolerance(k)));
  return off.length === 0 || (off.length === 1 && shared.length >= 4);
}

/** Which of two entries of one frame supplies the numbers: fewer estimates, more sizes, later, then by source. */
const leads = (a: Entry, b: Entry) =>
  a.estimated.length - b.estimated.length || b.rows.length - a.rows.length || b.lastYear - a.lastYear
  || cmp(b.retrieved, a.retrieved) || cmp(a.source, b.source);

/** Two entries of one frame as one: the leader's numbers and source, sizes only the other lists, and both spans. */
function join(a: Entry, b: Entry, model: string): Entry {
  const [lead, rest] = leads(a, b) <= 0 ? [a, b] : [b, a];
  const have = new Set(lead.rows.map((r) => r[0]));
  const extra = rest.rows.filter((r) => !have.has(r[0]));
  const est = new Set([...lead.estimated, ...(extra.length ? rest.estimated : [])]);
  const aliases = [...new Set([...a.aliases, ...b.aliases, a.model, b.model])].filter((n) => n !== model).sort(cmp);
  return {
    ...lead, model, year: Math.min(a.year, b.year), lastYear: Math.max(a.lastYear, b.lastYear),
    tyreWidth: lead.tyreWidth ?? rest.tyreWidth, maxSpacers: lead.maxSpacers ?? rest.maxSpacers, aliases,
    rows: [...lead.rows, ...extra].sort(byStack), estimated: OPTIONAL.filter((k) => est.has(k)), pages: a.pages + b.pages,
  };
}

/** Years between two spans; 0 when they touch or overlap. */
const gap = (a: Entry, b: Entry) => Math.max(0, a.year - b.lastYear, b.year - a.lastYear);

/**
 * Entries whose names are related (one starts with the other) and whose geometry is the same frame become one.
 * The name that states a generation leads, else the shorter one, and two stated generations never share an entry.
 *
 * A name without a generation joins a generation only when both were on sale together: an older bike of the
 * same geometry is the generation before. Makers start naming a generation once its successor exists ('Tarmac'
 * became 'Tarmac SL6' when the SL7 came), so when the catalog holds a later generation of the line, a year's gap
 * still counts as together. An entry that fits two generations joins the nearest in time, the older on a tie.
 */
function mergeFamilies(entries: Entry[]): Entry[] {
  const newest = new Map<string, number>();
  for (const e of entries) {
    if (generation(e.model)) newest.set(line(e.model), Math.max(newest.get(line(e.model)) ?? 0, generationNumber(e.model)));
  }
  /** How many years an entry without a generation may sit from this named one and still be it. */
  const slack = (named: string) => (newest.get(line(named))! > generationNumber(named) ? 1 : 0);
  const sorted = [...entries].sort((a, b) =>
    b.lastYear - a.lastYear || b.year - a.year || a.estimated.length - b.estimated.length
    || a.model.length - b.model.length || cmp(a.model, b.model) || cmp(a.source, b.source));
  const out: Entry[] = [];
  for (const m of sorted) {
    const gen = generation(m.model);
    let at = -1;
    // Best first: a group that states a generation, then the nearest in time, then the one that ended earlier.
    const rank = (g: Entry) => [generation(g.model) ? 0 : 1, gap(g, m), g.lastYear, g.year];
    out.forEach((g, i) => {
      const gg = generation(g.model);
      if (!related(g.model, m.model) || !sameFrame(g, m)) return;
      if (gen !== gg && ((gen && gg) || gap(g, m) > slack(gen ? m.model : g.model))) return;
      if (at < 0) at = i;
      else {
        const [a, b] = [rank(g), rank(out[at])];
        const d = a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3];
        if (d < 0) at = i;
      }
    });
    if (at < 0) out.push(m);
    else {
      const g = out[at];
      const gg = generation(g.model);
      const mine = gen !== gg ? !!gen : m.model.length < g.model.length;
      out[at] = join(g, m, mine ? m.model : g.model);
    }
  }
  return out;
}

/** The model year a page first appearing at this time belongs to: next year's bikes go online from July. */
export const modelYear = (ts: string) => Number(ts.slice(0, 4)) + (Number(ts.slice(4, 6)) >= 7 ? 1 : 0);

/**
 * The year of a page that states no model year. A page shows its bike was on sale in the calendar year of its
 * capture. The earliest page of a URL is dated by the URL's first capture instead, as a model year, though never
 * after its own capture nor before the catalog starts.
 */
function seenYear(entry: Manifest['pages'][number], earliest: Map<string, string>): number {
  const seen = Number(entry.timestamp.slice(0, 4));
  if (!entry.firstSeen || entry.timestamp !== earliest.get(entry.url)) return seen;
  return Math.max(MIN_YEAR, Math.min(modelYear(entry.firstSeen), seen));
}

export function buildBrand(
  adapter: Adapter, manifest: Manifest, pages: Map<string, Page>, overrides: Overrides, fill: Fill,
  log: (s: string) => void = () => {},
): BrandFile {
  const cands: (Entry & { timestamp: string })[] = [];
  const earliest = new Map<string, string>();
  for (const entry of manifest.pages) {
    if (overrides.exclude.includes(entry.url)) continue;
    const t = earliest.get(entry.url);
    if (!t || entry.timestamp < t) earliest.set(entry.url, entry.timestamp);
  }
  for (const entry of manifest.pages) {
    if (overrides.exclude.includes(entry.url)) continue;
    const page = pages.get(pageKey(entry.url, entry.timestamp));
    if (!page) continue;
    for (const e of adapter.extract(page)) {
      const fix = overrides.models[e.model] ?? {};
      if (fix.drop) continue;
      const year = e.year ?? seenYear(entry, earliest);
      if (year < MIN_YEAR) continue;
      const model = fix.model ?? e.model;
      const category = fix.category ?? e.category;
      const c = clean({ ...e, model, category }, fill, log);
      if (!c) continue;
      cands.push({
        model, category, year, lastYear: year, tyreWidth: fix.tyreWidth ?? e.tyreWidth, maxSpacers: fix.maxSpacers,
        aliases: fix.aliases ?? e.aliases ?? [], rows: c.rows, estimated: c.estimated, source: entry.url, timestamp: entry.timestamp,
        retrieved: dateOf(entry.timestamp), archive: `https://web.archive.org/web/${entry.timestamp}/${entry.url}`, pages: 1,
      });
    }
  }
  // Pages of one name showing the same frame become one entry with a year range.
  const extracted: Entry[] = [];
  for (const { timestamp: _t, ...c } of cands.sort((a, b) =>
    a.year - b.year || cmp(a.source, b.source) || cmp(a.model, b.model) || cmp(a.timestamp, b.timestamp))) {
    const i = extracted.findIndex((g) => g.model === c.model && sameFrame(g, c));
    if (i < 0) extracted.push(c);
    else extracted[i] = join(extracted[i], c, c.model);
  }
  // Hand-entered models join unless a page covers their source or the same name over their years.
  const list = [...extracted].sort((x, y) => cmp(x.source, y.source));
  const sources = new Set(cands.map((c) => stripUrl(c.source)));
  for (const m of overrides.manual) {
    if (sources.has(stripUrl(m.source))) continue;
    const last = m.lastYear ?? m.year;
    if (extracted.some((x) => slug(x.model) === slug(m.model) && x.year <= last && x.lastYear >= m.year)) continue;
    list.push({
      model: m.model, year: m.year, lastYear: last, category: m.category, tyreWidth: m.tyreWidth, maxSpacers: m.maxSpacers,
      aliases: m.aliases ?? [], rows: m.sizes, estimated: m.estimated ?? [], source: m.source, retrieved: m.retrieved,
      archive: m.archive, pages: 0,
    });
  }
  const merged = mergeFamilies(list).map((m) => {
    const pin = overrides.years?.find((p) => p.model === m.model && m.rows.some((r) => r[0] === p.size && r[1] === p.stack && r[2] === p.reach));
    return pin ? { ...m, year: pin.year, lastYear: Math.max(pin.lastYear ?? m.lastYear, pin.year) } : m;
  });
  // One entry per model and first year: of two frames sharing both, the one more pages show stays.
  const byId = new Map<string, Entry>();
  for (const m of merged.sort((a, b) => b.pages - a.pages || b.lastYear - a.lastYear || leads(a, b))) {
    const id = `${slug(m.model)}-${m.year}`;
    if (byId.has(id)) log(`duplicate: ${manifest.brand} ${m.model} ${m.year} ${m.source}`);
    else byId.set(id, m);
  }
  const models = [...byId.values()].sort((a, b) => cmp(a.model, b.model) || a.year - b.year).map((m): Model => ({
    model: m.model, year: m.year, lastYear: m.lastYear > m.year ? m.lastYear : undefined, category: m.category,
    source: m.source, retrieved: m.retrieved, archive: m.archive, aliases: m.aliases.length ? m.aliases : undefined,
    tyreWidth: m.tyreWidth, maxSpacers: m.maxSpacers, estimated: m.estimated.length ? m.estimated : undefined, sizes: m.rows,
  }));
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
