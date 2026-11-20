import type { CatalogView } from './find.svelte';
import { runOptimize } from './lib/optimizeClient';
import { KNOB_ORDER } from './lib/knobs';
import { buildLadder, sameParams, STEPS, stepLocks, type Ladder } from './lib/ladder';
import { defaults, migrate, type AppData } from './lib/appData';
import { bodyMismatch, type Mismatch } from './lib/mismatch';
import { resolveSegments } from './model/body';
import type { CompareRow, FitProblem } from './model/optimize';
import type { Verdict } from './model/verdict';
import { forwardLayout } from './model/geometry';
import { evaluateFit } from './model/pose';
import { makeContext, poseWeights } from './model/riding';
import { fitCost, fitScore, partPenalty } from './model/score';
import { bandsFor, STYLES } from './model/styles';
import type { MeasureId } from './lib/measure';
import { decodeShare, encodeShare } from './lib/share';
import { bikeOf, event, reportError, sizeOf } from './lib/analytics';
import type { FitParams, Frame, ParamKey } from './model/types';

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

/** How this page load started, for the App opened event. */
export let startedFrom: 'new' | 'saved' | 'link' = 'new';

function load(): AppData {
  const shared = fromLink();
  if (shared) {
    startedFrom = 'link';
    return shared;
  }
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    if (raw) {
      const d = migrate(JSON.parse(raw));
      if (d) {
        startedFrom = 'saved';
        return d;
      }
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
  /** Which setup the Fit my bike settings change. */
  editing: 'current' as 'current' | 'target',
  /** The three targets worked out from the current setup. */
  ladder: null as Ladder | null,
  /** The ladder step the target follows; null for a target of your own. */
  rung: null as number | null,
  /** Whether the ladder is being worked out. */
  laddering: false,
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

ui.editing = sameParams($state.snapshot(app.baseline) as FitParams, $state.snapshot(app.current) as FitParams) ? 'current' : 'target';

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
    locks: app.pins,
    mode,
    stock: st.stock,
  });
}

export function clearResult() {
  ui.notes = null;
  ui.verdict = null;
  ui.flags = [];
}

export function clearFeedback() {
  clearResult();
  ui.ladder = null;
}

/** What a ladder was worked out for; it is shown only while this still matches. */
export function ladderKey(): string {
  return JSON.stringify(snap({
    baseline: app.baseline, pins: app.pins, body: app.body, styleId: app.styleId, effort: app.effort,
    hands: app.hands, frame: activeFrame(), components: app.components, options: app.options,
  }));
}

/** The score the score pill shows for a setup on the active frame. */
export function setupScore(p: FitParams): number {
  const pr = problem('tune');
  const ctx = makeContext(pr.frame, pr.components, pr.ankling, pr.effort);
  const ev = evaluateFit(pr.segments, forwardLayout(pr.frame, pr.components, p), ctx, pr.targets);
  return fitScore(fitCost(ev, pr.targets, pr.poseWeights) + partPenalty(p));
}

/**
 * Sets one knob on the side being edited. A knob the target leaves where the current setup has it follows
 * an edit of the current setup, so entering your bike never makes changes.
 */
export function setKnob(k: ParamKey, v: number) {
  if (ui.editing === 'current') {
    if (app.current[k] === app.baseline[k]) app.current[k] = v;
    app.baseline[k] = v;
  } else {
    app.current[k] = v;
  }
  clearResult();
}

function applyStep(i: number) {
  if (!ui.ladder) return;
  // A step that gains nothing stands for the rung below it.
  let j = i;
  while (j >= 0 && ui.ladder.steps[j].same) j--;
  ui.animate = true;
  if (j < 0) {
    ui.rung = null;
    ui.editing = 'current';
    Object.assign(app.current, snap(app.baseline));
    clearResult();
    return;
  }
  ui.rung = j;
  const st = ui.ladder.steps[j];
  Object.assign(app.current, snap(st.params));
  ui.notes = st.notes;
  ui.verdict = st.verdict;
  ui.flags = st.flags;
}

/** Tapping the switch: -1 shows and edits your current setup, a step makes it the target. */
export function chooseRung(i: number) {
  event('Target chosen', { step: i < 0 ? 'current' : STEPS[i] });
  if (i < 0) {
    ui.editing = 'current';
    return;
  }
  ui.editing = 'target';
  ui.rung = i;
  if (ui.ladder?.key === ladderKey()) applyStep(i);
}

let ladderRun = 0;
let pendingKey = '';

/** Works out the three targets from the current setup, unless they are already up to date. */
export async function refreshLadder() {
  const key = ladderKey();
  if (ui.ladder?.key === key || pendingKey === key) return;
  const run = ++ladderRun;
  pendingKey = key;
  ui.laddering = true;
  ui.error = '';
  try {
    const p = problem('tune');
    const results = await Promise.all(
      STEPS.map((s) => runOptimize({ ...p, current: p.baseline, locks: stepLocks(s, p.locks) })),
    );
    if (run !== ladderRun) return;
    const lad = buildLadder(results, snap(app.baseline), setupScore, key);
    ui.ladder = lad;
    if (ui.rung === null && !sameParams(snap(app.current), snap(app.baseline))) {
      const i = lad.steps.findIndex((st) => sameParams(st.params, snap(app.current)));
      if (i >= 0) ui.rung = i;
    }
    if (ui.rung !== null) applyStep(ui.rung);
  } catch (e) {
    if (run !== ladderRun) return;
    ui.error = e instanceof Error ? e.message : String(e);
    reportError('optimize', e);
  } finally {
    if (run === ladderRun) {
      ui.laddering = false;
      pendingKey = '';
    }
  }
}

/** Rejects a suggested change: these settings stay as your bike has them, and the targets are worked out again. */
export function keepAsIs(keys: ParamKey[]) {
  event('Change rejected', { setting: keys[0] });
  for (const k of keys) {
    app.pins[k] = true;
    app.current[k] = app.baseline[k];
  }
  void refreshLadder();
}

/** Lets the targets change a setting again. */
export function release(k: ParamKey) {
  event('Change restored', { setting: k });
  app.pins[k] = false;
  void refreshLadder();
}

/** Why the current setup and the body measurements cannot both be right, if they cannot. */
export function currentMismatch(): Mismatch | null {
  const pr = problem('tune');
  return bodyMismatch(pr, snap(app.body), pr.baseline);
}

/** You have made the target's changes: the target becomes your current setup. */
export function markAsMine() {
  Object.assign(app.baseline, snap(app.current));
  ui.editing = 'current';
  ui.rung = null;
  clearFeedback();
}

export function useCompareRow(row: CompareRow) {
  app.activeFrameId = row.frameId;
  ui.animate = true;
  Object.assign(app.current, snap(row.result.params));
  Object.assign(app.baseline, snap(row.result.params));
  app.tab = 'mybike';
  // A different bike: nothing the rider kept on the old one carries over.
  for (const k of KNOB_ORDER) app.pins[k] = false;
  ui.editing = 'current';
  ui.rung = null;
  clearFeedback();
}

export function replaceApp(d: AppData) {
  Object.assign(app, d);
  ui.editing = sameParams(snap(app.baseline), snap(app.current)) ? 'current' : 'target';
  ui.rung = null;
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
    if (!d) {
      event('Imported', { ok: false });
      return false;
    }
    replaceApp(d);
    event('Imported', { ok: true });
    return true;
  } catch {
    event('Imported', { ok: false });
    return false;
  }
}

export function shareUrl(): string {
  return `${location.origin}${location.pathname}#d=${encodeShare($state.snapshot(app) as AppData)}`;
}
