import { runCompare, runOptimize } from './lib/optimizeClient';
import {
  defaults, effectiveLocks, level, migrate, type AppData, type Level, type SectionId,
} from './lib/appData';
import { resolveSegments } from './model/body';
import type { CompareRow, FitProblem } from './model/optimize';
import { EXAMPLE_FRAMES } from './model/presets';
import { poseWeights } from './model/riding';
import { bandsFor, STYLES } from './model/styles';
import type { MeasureId } from './lib/measure';
import type { FitParams, Frame } from './model/types';

export type { Tab } from './lib/appData';

const KEY = 'bikefit:v2';
const OLD_KEY = 'bikefit:v1';

function load(): AppData {
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
  compareRows: null as CompareRow[] | null,
  compareKey: '',
  crank: 0,
  playing: false,
  animate: false,
  viewPose: 'hoods' as 'hoods' | 'drops',
  measure: null as MeasureId | null,
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
    locks: effectiveLocks(level(app, 'setup'), app.locks),
    mode,
  });
}

export function setGlobalDetail(l: Level) {
  app.detail.global = l;
  app.detail.overrides = {};
}

export function setSectionDetail(s: SectionId, l: Level) {
  app.detail.overrides[s] = l;
}

export function clearGhost() {
  ui.ghost = null;
}

function clearFeedback() {
  ui.ghost = null;
  ui.undo = null;
  ui.notes = null;
}

export async function optimize() {
  ui.busy = true;
  ui.error = '';
  try {
    const before = snap(app.current);
    const result = await runOptimize(problem('tune'));
    ui.undo = before;
    ui.ghost = before;
    ui.animate = true;
    Object.assign(app.current, result.params);
    ui.notes = result.notes;
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
    const { frame: _f, mode: _m, locks: _l, ...rest } = p;
    ui.compareRows = await runCompare(rest, snap(app.frames));
    ui.compareKey = compareKey();
  } catch (e) {
    ui.error = e instanceof Error ? e.message : String(e);
  } finally {
    ui.busy = false;
  }
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
  app.frames.splice(i, 1);
  if (app.activeFrameId === id) app.activeFrameId = app.frames[0].id;
}
