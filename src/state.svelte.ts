import { runCompare, runOptimize } from './lib/optimizeClient';
import { resolveSegments } from './model/body';
import type { CompareRow, FitProblem } from './model/optimize';
import {
  DEFAULT_BODY, DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS, EXAMPLE_FRAMES,
} from './model/presets';
import { bandsFor, STYLES } from './model/styles';
import type { Body, Components, FitParams, Frame, ParamKey, PartOptions, StyleId } from './model/types';

export type Tab = 'rider' | 'bike' | 'fit' | 'compare';

export interface AppData {
  v: 1;
  body: Body;
  styleId: StyleId;
  frames: Frame[];
  activeFrameId: string;
  components: Components;
  options: PartOptions;
  current: FitParams;
  baseline: FitParams;
  locks: Record<ParamKey, boolean>;
  tab: Tab;
}

const KEY = 'bikefit:v1';

function defaults(): AppData {
  return structuredClone({
    v: 1 as const,
    body: DEFAULT_BODY,
    styleId: 'endurance' as StyleId,
    frames: EXAMPLE_FRAMES,
    activeFrameId: 'endurance-56',
    components: DEFAULT_COMPONENTS,
    options: DEFAULT_OPTIONS,
    current: DEFAULT_PARAMS,
    baseline: DEFAULT_PARAMS,
    locks: {
      saddleHeight: false, railOffset: false, seatpostSetback: false, spacers: false,
      stemLength: false, stemAngle: false, crankLength: false,
    },
    tab: 'fit' as Tab,
  });
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.v === 1 && Array.isArray(d.frames) && d.frames.length > 0) return { ...defaults(), ...d };
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
    bands: bandsFor(st, app.body.flexibility),
    elbowPref: st.poses[0].elbowPref,
    frame: activeFrame(),
    components: app.components,
    options: app.options,
    baseline: app.baseline,
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
    snap({ body: app.body, styleId: app.styleId, frames: app.frames, components: app.components, options: app.options }),
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
