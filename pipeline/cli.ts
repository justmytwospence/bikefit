import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrandFile } from '../src/data/schema';
import { adapterFor } from './brands/index';
import { pin, read, readCached } from './lib/cache';
import { buildBrand, fitEstimates, formatBrand, midFill, pageKey, type Fill } from './lib/build';
import { cdx, latestCapture, savePageNow } from './lib/wayback';
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

const bucketOf = (ts: string) => {
  const y = Number(ts.slice(0, 4));
  return y <= 2019 ? 0 : y <= 2021 ? 1 : y <= 2023 ? 2 : y <= 2025 ? 3 : 4;
};
const modelYear = (ts: string) => Number(ts.slice(0, 4)) + (Number(ts.slice(4, 6)) >= 7 ? 1 : 0);

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

async function discover(b: BrandEntry, a: Adapter) {
  const old = manifestOf(b);
  const have = new Map(old.pages.map((p) => [pageKey(p.url, p.timestamp), p]));
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
  const picks: { family: string; url: string; ts: string }[] = [];
  const families = new Set([...seen.values()].map((e) => e.family));
  for (const family of families) {
    for (let bucket = 0; bucket < 5; bucket++) {
      let best: { url: string; n: number; ts: string } | null = null;
      for (const e of seen.values()) {
        if (e.family !== family) continue;
        const inB = e.ts.filter((t) => bucketOf(t) === bucket).sort();
        if (!inB.length) continue;
        if (!best || inB.length > best.n || (inB.length === best.n && e.url.length < best.url.length)) {
          best = { url: e.url, n: inB.length, ts: inB[inB.length - 1] };
        }
      }
      if (best) picks.push({ family, url: best.url, ts: best.ts });
    }
  }
  const pages: PageEntry[] = [];
  let n = 0;
  for (const p of picks) {
    n++;
    const prior = have.get(pageKey(p.url, p.ts));
    if (prior) {
      pages.push(prior);
      continue;
    }
    try {
      const { capture, html } = await pin(p.url, p.ts);
      const related: Capture[] = [];
      const relHtml: Record<string, string> = {};
      for (const ru of a.related?.(html, p.url) ?? []) {
        const rts = await latestCapture(ru, p.ts);
        if (!rts) continue;
        const r = await pin(ru, rts);
        related.push(r.capture);
        relHtml[ru] = r.html;
      }
      const page: Page = { url: p.url, timestamp: p.ts, html, related: relHtml };
      if (!a.extract(page).length) continue;
      pages.push({ ...capture, family: p.family, year: modelYear(p.ts), related });
    } catch (e) {
      console.error(`${b.file}: skip ${p.url} @ ${p.ts}: ${e instanceof Error ? e.message : e}`);
    }
    if (n % 25 === 0) console.log(`${b.file}: ${n}/${picks.length}`);
  }
  writeManifest({ brand: b.brand, file: b.file, pages });
  console.log(`${b.file}: ${pages.length} pages from ${picks.length} captures`);
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
  if (!cmd || !['pin', 'discover', 'fetch', 'build', 'check'].includes(cmd) || !sel.length) {
    console.error('usage: npm run catalog -- pin|discover|fetch|build|check [brand-file...]');
    process.exit(2);
  }
  if (cmd === 'pin' || cmd === 'discover') {
    for (const b of sel) {
      const a = await adapterFor(b.file, b.brand);
      if (cmd === 'pin') await doPin(b, a);
      else await discover(b, a);
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
