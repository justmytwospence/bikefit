import { describe, expect, it } from 'vitest';
import { resolveSegments } from './body';
import { costOf, idealLayout, optimizeFit, wrenchList, type FitProblem } from './optimize';
import { evaluateFit } from './pose';
import { DEFAULT_BODY, DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS, EXAMPLE_FRAMES } from './presets';
import { outside } from './score';
import { bandsFor, STYLES } from './styles';
import type { Frame, MetricId, StyleId } from './types';

const segments = resolveSegments(DEFAULT_BODY);
const frame = (id: string) => EXAMPLE_FRAMES.find((f) => f.id === id)!;

function problem(style: StyleId, f: Frame, mode: 'shop' | 'tune' = 'shop'): FitProblem {
  const st = STYLES[style];
  return {
    segments, inseam: DEFAULT_BODY.inseam, bands: bandsFor(st, 'medium'), elbowPref: st.poses[0].elbowPref,
    frame: f, components: DEFAULT_COMPONENTS, options: DEFAULT_OPTIONS, baseline: DEFAULT_PARAMS, locks: {}, mode,
  };
}
const allIn = (p: FitProblem, ev: ReturnType<typeof optimizeFit>['evaluation']) =>
  (Object.keys(p.bands) as MetricId[]).every((k) => outside(ev.metrics[k], p.bands[k]) < 0.05);

describe('optimizeFit', () => {
  it('fits endurance on the endurance frame', () => {
    const p = problem('endurance', frame('endurance-56'));
    const t = performance.now();
    const r = optimizeFit(p);
    expect(performance.now() - t).toBeLessThan(2000);
    expect(allIn(p, r.evaluation)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(95);
  });
  it('fits race on the race frame', () => {
    const p = problem('race', frame('race-56'));
    expect(allIn(p, optimizeFit(p).evaluation)).toBe(true);
  });
  it('a tall, short-reach frame fits a racer worse and says why', () => {
    const odd: Frame = { ...frame('race-56'), id: 'odd', stack: 650, reach: 340 };
    const good = optimizeFit(problem('race', frame('race-56')));
    const bad = optimizeFit(problem('race', odd));
    expect(bad.score).toBeLessThan(good.score);
    expect(bad.notes.join(' ')).toContain('Torso');
  });
  it('respects locks and spacer steps', () => {
    const p = { ...problem('race', frame('race-56')), locks: { crankLength: true } };
    const r = optimizeFit(p);
    expect(r.params.crankLength).toBe(172.5);
    expect(r.params.spacers % 5).toBe(0);
    expect(r.params.spacers).toBeGreaterThanOrEqual(0);
    expect(r.params.spacers).toBeLessThanOrEqual(30);
  });
  it('tune mode never ends worse than the baseline', () => {
    const p = problem('endurance', frame('endurance-56'), 'tune');
    expect(optimizeFit(p).cost).toBeLessThanOrEqual(costOf(p, DEFAULT_PARAMS).cost);
  });
});

describe('idealLayout', () => {
  it('puts every race metric in band', () => {
    const st = STYLES.race;
    const bands = bandsFor(st, 'medium');
    const ideal = idealLayout(segments, bands, st.poses[0].elbowPref, DEFAULT_COMPONENTS, DEFAULT_OPTIONS.crankLengths);
    const L = {
      saddle: ideal.saddle, hand: ideal.hand, crankLength: ideal.crankLength,
      stemBase: ideal.hand, clamp: ideal.hand, headTop: ideal.hand, seatAxisTop: ideal.saddle,
    };
    const ev = evaluateFit(segments, L, DEFAULT_COMPONENTS.footStack, st.poses[0].elbowPref);
    for (const k of Object.keys(bands) as MetricId[]) expect(outside(ev.metrics[k], bands[k])).toBeLessThan(0.05);
  });
});

describe('wrenchList', () => {
  it('describes changes', () => {
    expect(wrenchList(DEFAULT_PARAMS, { ...DEFAULT_PARAMS, saddleHeight: 743, stemLength: 110 })).toEqual([
      'Raise the saddle 8 mm',
      'Swap the 100 mm −6° stem for a 110 mm −6° stem',
    ]);
  });
  it('reports no change', () => {
    expect(wrenchList(DEFAULT_PARAMS, { ...DEFAULT_PARAMS })).toEqual(['No changes from your current setup.']);
  });
});
