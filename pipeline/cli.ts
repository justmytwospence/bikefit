import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrandFile } from '../src/data/schema';
import { adapterFor } from './brands/index';
import { pin, read, readCached } from './lib/cache';
import { buildBrand, fitEstimates, formatBrand, midFill, modelYear, pageKey, type Fill } from './lib/build';
import { cdx, firstCapture, latestCapture, savePageNow } from './lib/wayback';
import type { Adapter, Capture, Manifest, Overrides, Page, PageEntry } from './types';

const ROOT = process.cwd();
const FRAMES = join(ROOT, 'src', 'data', 'frames');
const MANIFEST = join(ROOT, 'pipeline', 'manifest');
const OVERRIDES = join(ROOT, 'pipeline', 'overrides');

interface BrandEntry { file: string; brand: string; note?: string }
const brands: BrandEntry[] = JSON.parse(readFileSync(join(ROOT, 'pipeline', 'brands.json'), 'utf8'));

const readJson = <T>(f: string, fallback: T): T => (existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as T) : fallback);
const manifestOf = (b: BrandEntry): Manifest => readJson(join(MANIFEST, `${b.file}.json`), { brand: b.brand, file: b.file, pages: [] });
const overridesOf = (b: BrandEntry): Overrides => readJson(join(OVERRIDES, `${b.file}.json`), { manual: [], exclude: [], models: {} });

function writeManifest(m: Manifest) {
  mkdirSync(MANIFEST, { recursive: true });
  const pages = [...m.pages].sort((a, b) => a.family.localeCompare(b.family, 'en') || a.year - b.year || a.url.localeCompare(b.url, 'en'));
  writeFileSync(join(MANIFEST, `${m.file}.json`), JSON.stringify({ ...m, pages }, null, 1) + '\n');
}

const BUCKETS = ['to 2019', '2020-21', '2022-23', '2024-25', '2026 on'];
const bucketOf = (ts: string) => {
  const y = Number(ts.slice(0, 4));
  return y <= 2019 ? 0 : y <= 2021 ? 1 : y <= 2023 ? 2 : y <= 2025 ? 3 : 4;
};
const firstSeenCache = new Map<string, string | null>();
async function firstSeenOf(url: string): Promise<string | null> {
  if (!firstSeenCache.has(url)) firstSeenCache.set(url, await firstCapture(url));
  return firstSeenCache.get(url)!;
}

async function doPin(b: BrandEntry, a: Adapter) {
  for (const seed of a.seeds) {
    const ts = await latestCapture(seed);
    if (!ts || ts < '20260101000000') {
      console.log(`${b.file}: saving ${seed}`);
      await savePageNow(seed);
    }
  }
  for (const m of overridesOf(b).manual) {
    if (!(await latestCapture(m.source))) {
      console.log(`${b.file}: saving ${m.source}`);
      await savePageNow(m.source);
    }
  }
}

/** Captures a family/year bucket may use, best first: most-captured URLs, newest capture of each. */
interface Group { family: string; bucket: number; tries: { url: string; ts: string }[] }
const MAX_TRIES = 4;

async function groupsOf(a: Adapter): Promise<Group[]> {
  const seen = new Map<string, { family: string; url: string; ts: string[] }>();
  for (const prefix of a.prefixes) {
    for (const row of await cdx(prefix)) {
      const acc = a.accept(row.original);
      if (!acc) continue;
      const k = `${acc.family}\u0000${acc.url}`;
      const e = seen.get(k) ?? { family: acc.family, url: acc.url, ts: [] };
      e.ts.push(row.timestamp);
      seen.set(k, e);
    }
  }
  const out: Group[] = [];
  const families = new Set([...seen.values()].map((e) => e.family));
  for (const family of families) {
    for (let bucket = 0; bucket < 5; bucket++) {
      const urls = [...seen.values()]
        .filter((e) => e.family === family)
        .map((e) => ({ url: e.url, ts: e.ts.filter((t) => bucketOf(t) === bucket).sort() }))
        .filter((e) => e.ts.length)
        .sort((x, y) => y.ts.length - x.ts.length || x.url.length - y.url.length);
      // Some captures lack the geometry (it loaded after the archive took the page): try others.
      const tries = urls.flatMap((e) => e.ts.slice(-2).reverse().map((ts) => ({ url: e.url, ts }))).slice(0, MAX_TRIES);
      if (tries.length) out.push({ family, bucket, tries });
    }
  }
  return out;
}

/** Pins a capture and its related URLs, and returns the manifest entry when the adapter finds geometry. */
async function tryCapture(a: Adapter, family: string, url: string, ts: string): Promise<PageEntry | null> {
  const { capture, html } = await pin(url, ts);
  const related: Capture[] = [];
  const relHtml: Record<string, string> = {};
  for (const ru of a.related?.(html, url) ?? []) {
    // The capture nearest before the page; else any, since endpoints keyed by product id were often archived later.
    const rts = (await latestCapture(ru, ts)) ?? (await latestCapture(ru));
    if (!rts) continue;
    const r = await pin(ru, rts);
    related.push(r.capture);
    relHtml[ru] = r.html;
  }
  const page: Page = { url, timestamp: ts, html, related: relHtml };
  if (!a.extract(page).length) return null;
  const firstSeen = (await firstSeenOf(url)) ?? undefined;
  return { ...capture, family, year: modelYear(ts), related, firstSeen };
}

/** The first capture of a group with geometry; logs every one that has none. */
async function resolveGroup(b: BrandEntry, a: Adapter, g: Group, have: Map<string, PageEntry>): Promise<PageEntry | null> {
  for (const t of g.tries) {
    const prior = have.get(pageKey(t.url, t.ts));
    if (prior) return prior;
    try {
      const entry = await tryCapture(a, g.family, t.url, t.ts);
      if (entry) return entry;
      console.warn(`${b.file}: no geometry in ${t.url} @ ${t.ts}`);
    } catch (e) {
      console.error(`${b.file}: skip ${t.url} @ ${t.ts}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return null;
}

async function discover(b: BrandEntry, a: Adapter) {
  const have = new Map(manifestOf(b).pages.map((p) => [pageKey(p.url, p.timestamp), p]));
  const groups = await groupsOf(a);
  const pages: PageEntry[] = [];
  const empty: string[] = [];
  let n = 0;
  for (const g of groups) {
    const entry = await resolveGroup(b, a, g, have);
    if (entry) pages.push(entry);
    else empty.push(`${g.family} (${BUCKETS[g.bucket]})`);
    if (++n % 25 === 0) console.log(`${b.file}: ${n}/${groups.length}`);
  }
  writeManifest({ brand: b.brand, file: b.file, pages });
  console.log(`${b.file}: ${pages.length} pages for ${groups.length} family/year groups`);
  if (empty.length) console.warn(`${b.file}: no geometry for ${empty.length} groups: ${empty.join(', ')}`);
}

/**
 * Read-only check of discovery: which family/year groups the manifest has no page for, and whether
 * a capture with geometry exists for them now (pinning pages into the cache, never the manifest).
 */
async function audit(b: BrandEntry, a: Adapter): Promise<{ groups: number; missing: number; recoverable: string[]; empty: string[] }> {
  const pages = manifestOf(b).pages;
  const covered = new Set(pages.map((p) => `${p.family}\u0000${bucketOf(p.timestamp)}`));
  const groups = await groupsOf(a);
  const recoverable: string[] = [];
  const empty: string[] = [];
  for (const g of groups) {
    if (covered.has(`${g.family}\u0000${g.bucket}`)) continue;
    const label = `${g.family} (${BUCKETS[g.bucket]})`;
    const entry = await resolveGroup(b, a, g, new Map());
    (entry ? recoverable : empty).push(label);
  }
  const missing = recoverable.length + empty.length;
  console.log(`${b.file}: ${groups.length} groups, ${missing} without a page: ${recoverable.length} recoverable, ${empty.length} with no geometry in ${MAX_TRIES} captures`);
  for (const r of recoverable) console.log(`  recoverable: ${r}`);
  for (const e of empty) console.log(`  no geometry: ${e}`);
  return { groups: groups.length, missing, recoverable, empty };
}

async function fetchAll(b: BrandEntry) {
  const m = manifestOf(b);
  for (const p of m.pages) {
    await read(p);
    for (const r of p.related) await read(r);
  }
  console.log(`${b.file}: ${m.pages.length} pages cached`);
}

function loadPages(b: BrandEntry, strict: boolean): Map<string, Page> | null {
  const out = new Map<string, Page>();
  for (const p of manifestOf(b).pages) {
    const html = readCached(p);
    if (html === null) {
      if (strict) throw new Error(`Run npm run catalog -- fetch ${b.file}`);
      return null;
    }
    const related: Record<string, string> = {};
    for (const r of p.related) {
      const rh = readCached(r);
      if (rh === null) {
        if (strict) throw new Error(`Run npm run catalog -- fetch ${b.file}`);
        return null;
      }
      related[r.url] = rh;
    }
    out.set(pageKey(p.url, p.timestamp), { url: p.url, timestamp: p.timestamp, html, related });
  }
  return out;
}

/** Builds every brand file: a first pass finds the measured geometry, the second fills estimates from it. */
async function buildAll(only: string[], strict: boolean): Promise<Map<string, { text: string; file: BrandFile; manual: number }>> {
  const adapters = new Map<string, Adapter>();
  for (const b of brands) adapters.set(b.file, await adapterFor(b.file, b.brand));
  const pass1: BrandFile[] = [];
  for (const b of brands) {
    const pages = loadPages(b, strict && only.includes(b.file));
    if (!pages) {
      console.warn(`${b.file}: not cached, skipped in the estimate fit`);
      continue;
    }
    pass1.push(buildBrand(adapters.get(b.file)!, manifestOf(b), pages, overridesOf(b), midFill));
  }
  const fill: Fill = fitEstimates(pass1);
  const out = new Map<string, { text: string; file: BrandFile; manual: number }>();
  for (const b of brands) {
    if (!only.includes(b.file)) continue;
    const pages = loadPages(b, true)!;
    const log = (s: string) => console.log(`${b.file}: ${s}`);
    const file = buildBrand(adapters.get(b.file)!, manifestOf(b), pages, overridesOf(b), fill, log);
    const manual = overridesOf(b).manual.filter((m) => file.models.some((x) => x.source === m.source && x.model === m.model)).length;
    out.set(b.file, { text: formatBrand(file), file, manual });
  }
  return out;
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const sel = args.length ? brands.filter((b) => args.includes(b.file)) : brands;
  if (!cmd || !['pin', 'discover', 'audit', 'fetch', 'build', 'check', 'firstseen'].includes(cmd) || !sel.length) {
    console.error('usage: npm run catalog -- pin|discover|audit|fetch|build|check|firstseen [brand-file...]');
    process.exit(2);
  }
  if (cmd === 'audit') {
    let total = 0;
    const recoverable: string[] = [];
    for (const b of sel) {
      const a = await adapterFor(b.file, b.brand);
      if (!a.prefixes.length) continue;
      const r = await audit(b, a);
      total += r.missing;
      if (r.recoverable.length) recoverable.push(`${b.file} (${r.recoverable.length})`);
    }
    console.log(`audit: ${total} groups without a page; recoverable by discover: ${recoverable.join(', ') || 'none'}`);
  } else if (cmd === 'pin' || cmd === 'discover') {
    for (const b of sel) {
      const a = await adapterFor(b.file, b.brand);
      if (cmd === 'pin') await doPin(b, a);
      else await discover(b, a);
    }
  } else if (cmd === 'firstseen') {
    for (const b of sel) {
      const m = manifestOf(b);
      const known = new Map(m.pages.filter((p) => p.firstSeen).map((p) => [p.url, p.firstSeen!]));
      const urls = [...new Set(m.pages.map((p) => p.url))];
      let missing = 0;
      for (const u of urls) {
        if (known.has(u)) continue;
        try {
          const ts = await firstCapture(u);
          if (ts) known.set(u, ts);
        } catch (e) {
          missing++;
          console.error(`${b.file}: ${u}: ${e instanceof Error ? e.message : e}`);
        }
        if (known.size % 20 === 0) writeManifest({ ...m, pages: m.pages.map((p) => ({ ...p, firstSeen: known.get(p.url) })) });
      }
      writeManifest({ ...m, pages: m.pages.map((p) => ({ ...p, firstSeen: known.get(p.url) })) });
      console.log(`${b.file}: ${urls.length} urls, ${missing} failed`);
    }
  } else if (cmd === 'fetch') {
    for (const b of sel) await fetchAll(b);
  } else if (cmd === 'build') {
    const built = await buildAll(sel.map((b) => b.file), true);
    mkdirSync(FRAMES, { recursive: true });
    for (const [file, r] of built) {
      if (!r.file.models.length) {
        rmSync(join(FRAMES, `${file}.json`), { force: true });
        console.log(`${file}: no models`);
        continue;
      }
      writeFileSync(join(FRAMES, `${file}.json`), r.text);
      const models = r.file.models;
      const sizes = models.reduce((s, m) => s + m.sizes.length, 0);
      const est = models.reduce((s, m) => s + (m.estimated?.length ?? 0) * m.sizes.length, 0);
      console.log(`${file}: ${models.length} models, ${sizes} sizes, ${est} estimated values, ${r.manual} manual`);
    }
  } else {
    const built = await buildAll(brands.map((b) => b.file), true);
    const bad: string[] = [];
    for (const [file, r] of built) {
      const f = join(FRAMES, `${file}.json`);
      if (!r.file.models.length) {
        if (existsSync(f)) bad.push(file);
      } else if (!existsSync(f) || readFileSync(f, 'utf8') !== r.text) bad.push(file);
    }
    if (bad.length) {
      console.error(`Out of date: ${bad.join(', ')}`);
      process.exit(1);
    }
    console.log(`${built.size} brand files rebuild identically`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
