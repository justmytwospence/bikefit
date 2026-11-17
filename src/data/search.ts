import type { CatalogModel, FrameCategory } from './catalog';

export interface SearchHit { model: CatalogModel; score: number; size: string | null }
export interface BrandGroup { brand: string; hits: SearchHit[] }

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();
}

/** Optimal string alignment distance; returns max + 1 once it must exceed max. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < min) min = v;
    }
    if (min > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return Math.min(prev[b.length], max + 1);
}

export function searchCatalog(
  models: CatalogModel[], query: string, category: FrameCategory | 'all' = 'all',
): SearchHit[] {
  const pool = category === 'all' ? models : models.filter((m) => m.category === category);
  const q = normalize(query);
  if (!q) return pool.map((model) => ({ model, score: 0, size: null }));
  const qt = q.split(' ');
  const hits: SearchHit[] = [];
  for (const model of pool) {
    const brandTokens = normalize(model.brand).split(' ');
    const tokens = [
      ...brandTokens, ...normalize(model.model).split(' '), ...Array.from({ length: model.lastYear - model.year + 1 }, (_, i) => String(model.year + i)), model.category,
      ...model.aliases.flatMap((a) => normalize(a).split(' ')),
    ].filter(Boolean);
    const compact = tokens.join('');
    const sizes = model.sizes.map((s) => ({ raw: s.size, norm: normalize(s.size) }));
    let total = 0;
    let size: string | null = null;
    let brandHit = false;
    let ok = true;
    for (const t of qt) {
      let best = 0;
      let brandBest = 0;
      const lim = t.length >= 7 ? 2 : 1;
      for (const w of tokens) {
        let s = 0;
        if (t === w) s = 1;
        else if (w.startsWith(t)) s = 0.9;
        else if (t.length >= 3 && w.includes(t)) s = 0.7;
        else if (t.length >= 4 && editDistance(t, w, lim) <= lim) s = 0.5;
        if (s > best) best = s;
        if (brandTokens.includes(w) && s > brandBest) brandBest = s;
      }
      if (t.length >= 3 && best < 0.6 && compact.includes(t)) best = 0.6;
      const sz = sizes.find((x) => x.norm === t);
      if (sz) {
        if (size === null) size = sz.raw;
        best = Math.max(best, 0.8);
      }
      if (best === 0) { ok = false; break; }
      total += best;
      if (brandBest >= 0.9) brandHit = true;
    }
    if (!ok) continue;
    hits.push({ model, score: total + (brandHit ? 0.25 : 0), size });
  }
  return hits.sort((a, b) =>
    b.score - a.score || a.model.brand.localeCompare(b.model.brand, 'en')
    || a.model.model.localeCompare(b.model.model, 'en') || b.model.year - a.model.year);
}

export function groupByBrand(hits: SearchHit[]): BrandGroup[] {
  const groups = new Map<string, BrandGroup>();
  for (const h of hits) {
    let g = groups.get(h.model.brand);
    if (!g) groups.set(h.model.brand, (g = { brand: h.model.brand, hits: [] }));
    g.hits.push(h);
  }
  return [...groups.values()];
}
