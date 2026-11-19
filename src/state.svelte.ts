import type { CatalogView } from './find.svelte';
import { runOptimize, runSizes } from './lib/optimizeClient';
import { sizeFamily, type SizeOption } from './lib/sizes';
import { defaults, migrate, type AppData } from './lib/appData';
import { resolveSegments } from './model/body';
import type { CompareRow, FitProblem, FitResult } from './model/optimize';
import type { Verdict } from './model/verdict';
import { poseWeights } from './model/riding';
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
  compareSource: 'all' as 'saved' | 'all',
  /** A bike shown on the drawing from Find a bike, with its suggested build; not saved, not yours until made so. */
  preview: null as {
    row: CompareRow;
    frame: Frame;
    /** The size this one is too close to call against, drawn in outline behind it. */
    other: { row: CompareRow; frame: Frame; size: string } | null;
  } | null,
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
    targets: bandsFor(st, app.body.flexibility, app.body.height),
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
    stock: st.stock,
  });
}

export function clearGhost() {
  ui.ghost = null;
}

export function clearFeedback() {
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

export function useCompareRow(row: CompareRow) {
  app.activeFrameId = row.frameId;
  ui.animate = true;
  Object.assign(app.current, snap(row.result.params));
  Object.assign(app.baseline, snap(row.result.params));
  app.tab = 'mybike';
  clearFeedback();
}

export function replaceApp(d: AppData) {
  Object.assign(app, d);
  clearFeedback();
  ui.compareRows = null;
  ui.preview = null;
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
