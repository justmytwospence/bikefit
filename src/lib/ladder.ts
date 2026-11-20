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

/** Where every step starts: your setup, except pinned knobs, which keep the target's value. */
export function stepStart(baseline: FitParams, target: FitParams, pins: Pins): FitParams {
  const out = { ...baseline };
  for (const k of KNOB_ORDER) if (pins[k]) out[k] = target[k];
  return out;
}

export interface LadderStep {
  step: Preset;
  params: FitParams;
  score: number;
  notes: string[];
  verdict: Verdict;
  flags: string[];
  /** Same setup as the step below: the extra freedom gains nothing. */
  same: boolean;
}

export interface Ladder {
  /** What the ladder was worked out for; shown only while `ladderKey()` still matches. */
  key: string;
  /** The current setup's score. */
  current: number;
  steps: LadderStep[];
  /** Index of the suggested step, or -1 when none beats the current setup. */
  suggested: number;
}

/**
 * Builds the ladder from one optimizer result per step, in STEPS order. A step that ended costlier than the
 * one below takes that one's result. `score` scores a setup the way the score pill does.
 */
export function buildLadder(
  results: FitResult[], score: (p: FitParams) => number, current: number, key: string,
): Ladder {
  const kept: FitResult[] = [];
  results.forEach((r, i) => kept.push(i > 0 && r.cost > kept[i - 1].cost ? kept[i - 1] : r));
  const steps: LadderStep[] = kept.map((r, i) => ({
    step: STEPS[i], params: r.params, score: score(r.params), notes: r.notes, verdict: r.verdict, flags: r.flags,
    same: i > 0 && sameParams(r.params, kept[i - 1].params),
  }));
  const scores = steps.map((s) => s.score);
  const best = Math.max(...scores);
  return { key, current, steps, suggested: best <= current ? -1 : scores.findIndex((s) => s >= best - 3) };
}
