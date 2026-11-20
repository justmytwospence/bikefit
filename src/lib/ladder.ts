import type { FitResult } from '../model/optimize';
import type { FitParams, ParamKey } from '../model/types';
import type { Verdict } from '../model/verdict';
import { KNOB_ORDER, presetLocks, type Preset } from './knobs';

export const STEPS: Preset[] = ['tools', 'parts', 'all'];
export type Pins = Partial<Record<ParamKey, boolean>>;

/** Two setups are the same when no knob differs by a quarter millimetre or degree. */
export function sameParams(a: FitParams, b: FitParams): boolean {
  return KNOB_ORDER.every((k) => Math.abs(a[k] - b[k]) < 0.25);
}

/** One step's locks: every knob outside the step, plus the ones the rider pinned. */
export function stepLocks(step: Preset, pins: Pins): Record<ParamKey, boolean> {
  const base = presetLocks(step);
  const out = {} as Record<ParamKey, boolean>;
  for (const k of KNOB_ORDER) out[k] = base[k] || !!pins[k];
  return out;
}

/** Changes too small to bother with go back to the current setup and the rest land on whole millimetres, unless that costs a point. */
export function settle(p: FitParams, base: FitParams, score: (p: FitParams) => number): FitParams {
  const floor = score(p);
  let out = { ...p };
  for (const [k, min] of [['saddleHeight', 3], ['railOffset', 3], ['cleatOffset', 2]] as const) {
    const d = out[k] - base[k];
    const v = Math.abs(d) < min ? base[k] : base[k] + Math.round(d);
    if (v === out[k]) continue;
    const next = { ...out, [k]: v };
    if (score(next) >= floor) out = next;
  }
  return out;
}

export interface LadderStep {
  step: Preset;
  params: FitParams;
  score: number;
  notes: string[];
  verdict: Verdict | null;
  flags: string[];
  /** Gains less than a point over the step below (or the current setup): the extra freedom buys nothing. */
  same: boolean;
}

export interface Ladder {
  /** What the ladder was worked out for; shown only while `ladderKey()` still matches. */
  key: string;
  /** The current setup's score. */
  current: number;
  steps: LadderStep[];
  /** Index of the suggested step, or -1 when the current setup is within three points of the best. */
  suggested: number;
}

/**
 * Builds the ladder from one optimizer result per step, in STEPS order. A step that gains less than a point over
 * the rung below (the current setup at the bottom) takes that rung's setup and is marked same. `score` scores a
 * setup the way the score pill does.
 */
export function buildLadder(
  results: FitResult[], baseline: FitParams, score: (p: FitParams) => number, key: string,
): Ladder {
  const current = score(baseline);
  type Kept = Omit<LadderStep, 'step' | 'same'>;
  let prev: Kept = { params: baseline, score: current, notes: [], verdict: null, flags: [] };
  const steps: LadderStep[] = results.map((r, i) => {
    const params = settle(r.params, baseline, score);
    const s = score(params);
    const gain = s >= prev.score + 1;
    const kept: Kept = gain ? { params, score: s, notes: r.notes, verdict: r.verdict, flags: r.flags } : prev;
    prev = kept;
    return { step: STEPS[i], ...kept, same: !gain };
  });
  const best = Math.max(...steps.map((s) => s.score));
  return {
    key, current, steps,
    suggested: current >= best - 3 ? -1 : steps.findIndex((s) => !s.same && s.score >= best - 3),
  };
}
