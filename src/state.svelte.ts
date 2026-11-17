import { screenCatalog } from './lib/catalogFit';
import { runCatalog, runCompare, runOptimize, runSizes, stopCatalog } from './lib/optimizeClient';
import { sizeFamily, type SizeOption } from './lib/sizes';
import { defaults, migrate, type AppData } from './lib/appData';
import { resolveSegments } from './model/body';
import { idealLayout, type CompareRow, type FitProblem, type FitResult, type Verdict } from './model/optimize';
import { EXAMPLE_FRAMES } from './model/presets';
import { makeContext, poseWeights } from './model/riding';
import { bandsFor, STYLES } from './model/styles';
import type { MeasureId } from './lib/measure';
import { decodeShare, encodeShare } from './lib/share';
import type { FitParams, Frame } from './model/types';

export type { Tab } from './lib/appData';

const KEY = 'bikefit:v2';
const OLD_KEY = 'bikefit:v1';

function fromLink(): AppData | null {
  if (typeof location === 'undefined' || !location.hash.startsWith('#d=')) return null;
  const d = decodeShare(location.hash.slice(3));
  history.replaceState(null, '', location.pathname + location.search);
  if (!d) return null;
  return confirm('Open the shared setup? It replaces the setup saved in this browser.') ? d : null;
}

function load(): AppData {
  const shared = fromLink();
  if (shared) return shared;
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    if (raw) {
      const d = migrate(JSON.parse(raw));
      if (d) return d;
    }
  } catch {
    /* fall through to defaults */
  }
  return defaults();
}

export const app: AppData = $state(load());

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

export const ui = $state({
  busy: false,
  error: '' as string,
  ghost: null as FitParams | null,
  undo: null as FitParams | null,
  notes: null as string[] | null,
  verdict: null as Verdict | null,
  flags: [] as string[],
  compareRows: null as CompareRow[] | null,
  compareKey: '',
  crank: 0,
  playing: false,
  animate: false,
  viewPose: 'hoods' as 'hoods' | 'drops',
  measure: null as MeasureId | null,
  sizes: null as { rows: CompareRow[]; options: SizeOption[] } | null,
  compareSource: 'saved' as 'saved' | 'all',
  catalog: null as CatalogView | null,
});

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify($state.snapshot(app)));
  } catch {
    /* storage unavailable */
  }
}

const snap = <T>(x: T): T => $state.snapshot(x) as T;

export function activeFrame(): Frame {
  return app.frames.find((f) => f.id === app.activeFrameId) ?? app.frames[0];
}

export function problem(mode: 'tune' | 'shop'): FitProblem {
  const st = STYLES[app.styleId];
  return snap({
    segments: resolveSegments(app.body),
    inseam: app.body.inseam,
    targets: bandsFor(st, app.body.flexibility),
    poseWeights: poseWeights(app.hands ?? st.defaultHands),
    ankling: app.body.ankling,
    effort: app.effort ?? st.defaultEffort,
    frame: activeFrame(),
    components: app.components,
    options: app.options,
    baseline: app.baseline,
    current: app.current,
    locks: app.locks,
    mode,
  });
}

export function clearGhost() {
  ui.ghost = null;
}

function clearFeedback() {
  ui.ghost = null;
  ui.undo = null;
  ui.notes = null;
  ui.verdict = null;
  ui.flags = [];
  ui.sizes = null;
}

/** The sizes of the active frame's catalog model, when a new build may still choose among them. */
async function sizeOptions(): Promise<SizeOption[] | null> {
  const f = activeFrame();
  if (app.hasSetup || !f.id.startsWith('cat:')) return null;
  const cat = await import('./data/catalog');
  return sizeFamily(snap(f), cat.CATALOG, cat.toFrame);
}

/** Switches to another size from the last Optimize, saving it if needed, with that size's build. */
export function useSize(frameId: string) {
  const s = ui.sizes;
  const row = s?.rows.find((r) => r.frameId === frameId);
  const opt = s?.options.find((o) => o.frame.id === frameId);
  if (!s || !row || !opt) return;
  if (!app.frames.some((f) => f.id === frameId)) app.frames.push(snap(opt.frame));
  app.activeFrameId = frameId;
  ui.animate = true;
  Object.assign(app.current, snap(row.result.params));
  ui.ghost = null;
  ui.undo = null;
  ui.notes = row.result.notes;
  ui.verdict = row.result.verdict;
  ui.flags = row.result.flags;
}

export async function optimize() {
  ui.busy = true;
  ui.error = '';
  try {
    const before = snap(app.current);
    const p = problem(app.hasSetup ? 'tune' : 'shop');
    const options = await sizeOptions();
    let result: FitResult;
    if (options) {
      const rows = await runSizes(p, options.map((o) => o.frame));
      result = rows.find((r) => r.frameId === app.activeFrameId)!.result;
      ui.sizes = { rows, options };
    } else {
      result = await runOptimize(p);
      ui.sizes = null;
    }
    ui.undo = before;
    ui.ghost = before;
    ui.animate = true;
    Object.assign(app.current, result.params);
    ui.notes = result.notes;
    ui.verdict = result.verdict;
    ui.flags = result.flags;
  } catch (e) {
    ui.error = e instanceof Error ? e.message : String(e);
  } finally {
    ui.busy = false;
  }
}

export function undo() {
  if (!ui.undo) return;
  ui.animate = true;
  Object.assign(app.current, ui.undo);
  clearFeedback();
}

export function resetToBaseline() {
  ui.animate = true;
  Object.assign(app.current, snap(app.baseline));
  clearFeedback();
}

export function setHasSetup(on: boolean) {
  if (on) Object.assign(app.baseline, snap(app.current));
  app.hasSetup = on;
  clearFeedback();
}

export function markAsMine() {
  Object.assign(app.baseline, snap(app.current));
  clearFeedback();
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
    const p = problem('shop');
    const { frame: _f, mode: _m, locks: _l, current: _c, ...rest } = p;
    ui.compareRows = await runCompare(rest, snap(app.frames));
    ui.compareKey = compareKey();
  } catch (e) {
    ui.error = e instanceof Error ? e.message : String(e);
  } finally {
    ui.busy = false;
  }
}

export function catalogKey(): string {
  return JSON.stringify(snap({
    body: app.body, styleId: app.styleId, components: app.components,
    options: app.options, effort: app.effort, hands: app.hands, locks: app.locks,
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
  const cat = await import('./data/catalog');
  const { frame: _f, mode: _m, locks: _l, current: _c, ...rest } = problem('shop');
  const ideal = idealLayout(
    rest.segments, rest.targets, rest.poseWeights,
    makeContext(null, rest.components, rest.ankling, rest.effort), rest.components, rest.options.crankLengths,
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
    const rows = await runCatalog(rest, jobs, (r, done) => {
      latest = { rows: r, done };
      if (!timer) timer = setTimeout(flush, 250);
    }, snap(app.locks), ideal.hoods);
    if (timer) clearTimeout(timer);
    latest = { rows, done: jobs.length };
    flush();
    finished = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== 'Superseded' && run === catalogRun) ui.error = msg;
  } finally {
    if (timer) clearTimeout(timer);
    if (run === catalogRun && ui.catalog) {
      ui.catalog = ui.catalog.with({ running: false });
      if (finished) remember(ui.catalog);
    }
  }
}

/** Opens Compare on the catalog, checking it unless fresh results are there. */
export function browseCatalog() {
  app.tab = 'compare';
  ui.compareSource = 'all';
  if (!ui.catalog || (!ui.catalog.running && ui.catalog.key !== catalogKey())) void runCatalogFit();
}

/** Saves a catalog size if needed, then uses it like a saved Compare row. */
export function useCatalogRow(row: CompareRow) {
  const f = ui.catalog?.frames.find((x) => x.id === row.frameId);
  if (f && !app.frames.some((x) => x.id === f.id)) app.frames.push(snap(f));
  useCompareRow(row);
}

export function useCompareRow(row: CompareRow) {
  app.activeFrameId = row.frameId;
  ui.animate = true;
  Object.assign(app.current, snap(row.result.params));
  Object.assign(app.baseline, snap(row.result.params));
  app.tab = 'fit';
  clearFeedback();
}

export function selectFrame(id: string) {
  app.activeFrameId = id;
  clearFeedback();
}

export function duplicateFrame() {
  const f = structuredClone(activeFrame());
  f.id = crypto.randomUUID();
  f.name = f.name + ' copy';
  app.frames.push(f);
  app.activeFrameId = f.id;
}

export function newFrame() {
  const f = structuredClone(EXAMPLE_FRAMES[1]);
  f.id = crypto.randomUUID();
  f.name = 'My frame';
  app.frames.push(f);
  app.activeFrameId = f.id;
}

export function deleteFrame(id: string) {
  if (app.frames.length <= 1) return;
  const i = app.frames.findIndex((f) => f.id === id);
  if (i < 0) return;
  const [gone] = app.frames.splice(i, 1);
  if (app.activeFrameId !== id) return;
  // Deleting one size of a catalog model stays on that model when another size is saved.
  const cut = gone.name.lastIndexOf(' · ');
  const model = gone.id.startsWith('cat:') && cut >= 0 ? gone.name.slice(0, cut + 3) : null;
  const sibling = model ? app.frames.find((f) => f.id.startsWith('cat:') && f.name.startsWith(model)) : undefined;
  app.activeFrameId = (sibling ?? app.frames[Math.min(i, app.frames.length - 1)]).id;
  clearFeedback();
}

export function addCatalogFrame(f: Frame) {
  if (!app.frames.some((x) => x.id === f.id)) app.frames.push(structuredClone(f));
  app.activeFrameId = f.id;
  clearFeedback();
}

/** Saves every given frame not already saved; returns how many were new. Keeps the active frame. */
export function addCatalogModel(frames: Frame[]): number {
  let n = 0;
  for (const f of frames) {
    if (app.frames.some((x) => x.id === f.id)) continue;
    app.frames.push(structuredClone(f));
    n++;
  }
  return n;
}

export function replaceApp(d: AppData) {
  Object.assign(app, d);
  clearFeedback();
  ui.compareRows = null;
}

export function exportJson(): string {
  return JSON.stringify($state.snapshot(app), null, 2);
}

/** Replaces the app data with an export; false when the text is not one. */
export function importJson(text: string): boolean {
  try {
    const d = migrate(JSON.parse(text));
    if (!d) return false;
    replaceApp(d);
    return true;
  } catch {
    return false;
  }
}

export function shareUrl(): string {
  return `${location.origin}${location.pathname}#d=${encodeShare($state.snapshot(app) as AppData)}`;
}
