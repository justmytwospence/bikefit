import { bikeOf, event, reportError } from './lib/analytics';
import { screenCatalog } from './lib/catalogFit';
import { presetLocks } from './lib/knobs';
import type { SizeEntry } from './lib/sizes';
import { runCatalog, runCompare, stopCatalog } from './lib/optimizeClient';
import { idealLayout, type CompareRow } from './model/optimize';
import { makeContext } from './model/riding';
import type { Frame } from './model/types';
import { app, problem, ui, useCompareRow } from './state.svelte';

const snap = <T>(x: T): T => $state.snapshot(x) as T;

/** A new bike is fitted with the parts a shop swaps (stem, seatpost), and the crank length your legs call for. */
const findLocks = () => presetLocks('parts');

/** Immutable so Svelte does not deep-proxy thousands of rows; replace it with `with` to update. */
export class CatalogView {
  constructor(
    readonly rows: CompareRow[], readonly frames: Frame[], readonly modelOf: Record<string, string>,
    readonly done: number, readonly total: number, readonly key: string, readonly running: boolean,
  ) {}
  with(p: Partial<Pick<CatalogView, 'rows' | 'done' | 'running'>>): CatalogView {
    return new CatalogView(p.rows ?? this.rows, this.frames, this.modelOf, p.done ?? this.done, this.total, this.key, p.running ?? this.running);
  }
}

export function compareKey(): string {
  return JSON.stringify(
    snap({
      body: app.body, styleId: app.styleId, frames: app.frames, components: app.components,
      options: app.options, effort: app.effort, hands: app.hands,
    }),
  );
}

export async function runCompareAll() {
  ui.busy = true;
  ui.error = '';
  try {
    event('Compare saved', { frames: app.frames.length });
    const p = problem('shop');
    const { frame: _f, mode: _m, locks: _l, current: _c, ...rest } = p;
    ui.compareRows = await runCompare(rest, snap(app.frames));
    ui.compareKey = compareKey();
  } catch (e) {
    ui.error = e instanceof Error ? e.message : String(e);
    reportError('compare', e);
  } finally {
    ui.busy = false;
  }
}

export function catalogKey(): string {
  return JSON.stringify(snap({
    body: app.body, styleId: app.styleId, components: app.components,
    options: app.options, effort: app.effort, hands: app.hands, locks: findLocks(),
  }));
}

let catalogRun = 0;
const catalogCache = new Map<string, CatalogView>();
function remember(v: CatalogView) {
  catalogCache.delete(v.key);
  catalogCache.set(v.key, v);
  while (catalogCache.size > 6) catalogCache.delete(catalogCache.keys().next().value!);
}
export const hasCachedCatalog = (key: string): boolean => catalogCache.has(key);

/** Checks every catalog model for this rider and style, walking its sizes outward from the best start. */
export async function runCatalogFit() {
  const run = ++catalogRun;
  ui.error = '';
  const key = catalogKey();
  const hit = catalogCache.get(key);
  if (hit) {
    stopCatalog();
    ui.catalog = hit;
    return;
  }
  event('Find bikes', { style: app.styleId });
  const cat = await import('./data/catalog');
  const { frame: _f, mode: _m, locks: _l, current: _c, ...rest } = problem('shop');
  const ideal = idealLayout(
    rest.segments, rest.targets, rest.poseWeights,
    makeContext(null, rest.components, rest.ankling, rest.effort), rest.components, rest.options.crankLengths, rest.inseam,
  );
  const jobs = screenCatalog(cat.CATALOG, cat.toFrame, rest.components, ideal.hoods);
  const modelOf: Record<string, string> = {};
  for (const j of jobs) for (const f of j.frames) modelOf[f.id] = j.modelId;
  ui.catalog = new CatalogView([], jobs.flatMap((j) => j.frames), modelOf, 0, jobs.length, key, true);
  let finished = false;
  let latest: { rows: CompareRow[]; done: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (run === catalogRun && ui.catalog && latest) ui.catalog = ui.catalog.with(latest);
  };
  try {
    const rows = await runCatalog({ ...rest, baseline: { ...rest.baseline, crankLength: ideal.crankLength }, idealHoods: ideal.hoods }, jobs, (r, done) => {
      latest = { rows: r, done };
      if (!timer) timer = setTimeout(flush, 250);
    }, findLocks(), ideal.hoods);
    if (timer) clearTimeout(timer);
    latest = { rows, done: jobs.length };
    flush();
    finished = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== 'Superseded' && run === catalogRun) ui.error = msg;
    reportError('catalog', e);
  } finally {
    if (timer) clearTimeout(timer);
    if (run === catalogRun && ui.catalog) {
      ui.catalog = ui.catalog.with({ running: false });
      if (finished) remember(ui.catalog);
    }
  }
}

/** Shows a bike from Find a bike on the drawing with its suggested build; your own bike is untouched. */
export function previewRow(row: CompareRow, frames: Frame[]) {
  const f = frames.find((x) => x.id === row.frameId);
  if (!f) return;
  event('Bike shown', { bike: bikeOf(row.frameId, row.frameName), verdict: row.result.verdict });
  ui.preview = { row: snap(row), frame: snap(f), other: null };
  ui.animate = true;
}

/** Shows one size of a model; `other` is the size it is too close to call against, drawn in outline behind it. */
export function previewSize(e: SizeEntry, other: SizeEntry | null) {
  event('Bike shown', { bike: bikeOf(e.row.frameId, e.row.frameName), verdict: e.row.result.verdict });
  ui.preview = {
    row: snap(e.row), frame: snap(e.frame),
    other: other ? { row: snap(other.row), frame: snap(other.frame), size: other.size } : null,
  };
  ui.animate = true;
}

export function stopPreview() {
  ui.preview = null;
  ui.animate = true;
}

/** Makes the bike on show your bike, with its suggested build as your setup. */
export function makePreviewMine() {
  const p = ui.preview;
  if (!p) return;
  event('Bike made mine', { bike: bikeOf(p.row.frameId, p.row.frameName), verdict: p.row.result.verdict });
  if (!app.frames.some((f) => f.id === p.frame.id)) app.frames.push(snap(p.frame));
  useCompareRow(p.row);
  ui.preview = null;
}
