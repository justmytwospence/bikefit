import { describe, expect, it } from 'vitest';
import { resolveSegments } from './body';
import { dropsFromHoods } from './geometry';
import { compareFrames, costOf, idealLayout, optimizeFit, standoverHeight, wrenchList, type FitProblem } from './optimize';
import { evaluateFit } from './pose';
import { TEST_BODY } from './testFrames';
import { DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS, EXAMPLE_FRAMES } from './presets';
import { makeContext, poseWeights } from './riding';
import { outside } from './score';
import { bandsFor, STYLES } from './styles';
import type { Evaluation, Frame, MetricId, PoseTarget, StyleId } from './types';

const segments = resolveSegments(TEST_BODY);
const frame = (id: string) => EXAMPLE_FRAMES.find((f) => f.id === id)!;

function problem(style: StyleId, f: Frame, mode: 'shop' | 'tune' = 'shop'): FitProblem {
  const st = STYLES[style];
  return {
    segments, inseam: TEST_BODY.inseam, targets: bandsFor(st, 'medium'), poseWeights: poseWeights(st.defaultHands),
    ankling: 'neutral', effort: st.defaultEffort, frame: f, components: DEFAULT_COMPONENTS,
    options: DEFAULT_OPTIONS, baseline: DEFAULT_PARAMS, current: DEFAULT_PARAMS, locks: {}, mode,
  };
}
function allIn(targets: PoseTarget[], ev: Evaluation) {
  return targets.every((t, i) =>
    (Object.keys(t.bands) as MetricId[]).every((k) => {
      const b = t.bands[k]!;
      return b.weight === 0 || outside(ev.poses[i].metrics[k], b) < 0.05;
    }),
  );
}

describe('optimizeFit', () => {
  it('fits endurance on the endurance frame', () => {
    const p = problem('endurance', frame('endurance-56'));
    const t = performance.now();
    const r = optimizeFit(p);
    expect(performance.now() - t).toBeLessThan(1500);
    expect(allIn(p.targets, r.evaluation)).toBe(true);
    expect(r.params.stemLength).toBeLessThanOrEqual(120);
  });
  it('fits race on the race frame', () => {
    const p = problem('race', frame('race-56'));
    expect(allIn(p.targets, optimizeFit(p).evaluation)).toBe(true);
  });
  it('a tall, short-reach frame fits a racer worse and says why', () => {
    const odd: Frame = { ...frame('race-56'), id: 'odd', stack: 650, reach: 340 };
    const good = optimizeFit(problem('race', frame('race-56')));
    const bad = optimizeFit(problem('race', odd));
    expect(bad.score).toBeLessThan(good.score);
    expect(bad.notes.join(' ')).toContain('Torso');
  });
  it('respects locks, spacer steps and the cleat range', () => {
    const p = { ...problem('race', frame('race-56')), locks: { crankLength: true } };
    const r = optimizeFit(p);
    expect(r.params.crankLength).toBe(172.5);
    expect(r.params.spacers % 5).toBe(0);
    expect(r.params.spacers).toBeGreaterThanOrEqual(0);
    expect(r.params.spacers).toBeLessThanOrEqual(30);
    expect(r.params.cleatOffset).toBeGreaterThanOrEqual(0);
    expect(r.params.cleatOffset).toBeLessThanOrEqual(20);
  });
  it('keeps a locked knob at its current value, not the baseline', () => {
    const current = { ...DEFAULT_PARAMS, saddleHeight: 760, crankLength: 170 };
    const p = { ...problem('endurance', frame('endurance-56'), 'tune'), current, locks: { saddleHeight: true, crankLength: true } };
    const r = optimizeFit(p);
    expect(r.params.saddleHeight).toBe(760);
    expect(r.params.crankLength).toBe(170);
  });
  it('recovers from a saddle too high to reach the pedals', () => {
    const p = { ...problem('endurance', frame('endurance-56'), 'tune'), current: { ...DEFAULT_PARAMS, saddleHeight: 880 } };
    const r = optimizeFit(p);
    expect(r.evaluation.poses[0].overextended).toBe(false);
    expect(r.score).toBeGreaterThan(90);
  });
  it('avoids an upturned stem and maxed spacers when a neutral build fits', () => {
    const r = optimizeFit(problem('endurance', frame('endurance-56')));
    expect(r.params.stemAngle).toBeLessThan(10);
    expect(r.params.spacers).toBeLessThan(40);
    expect(r.flags).toEqual([]);
    expect(r.verdict).toBe('fits');
  });
  it('tune mode never ends worse than the baseline', () => {
    const p = problem('endurance', frame('endurance-56'), 'tune');
    expect(optimizeFit(p).cost).toBeLessThanOrEqual(costOf(p, DEFAULT_PARAMS).cost);
  });
});

describe('verdicts', () => {
  const sized = (id: string, stack: number, reach: number, seatTubeLength: number): Frame => ({
    ...frame('endurance-56'), id, name: id, stack, reach, seatTubeLength,
  });
  it('estimates standover from stack and seat tube', () => {
    expect(standoverHeight(frame('endurance-56'))).toBeCloseTo(820.4, 0);
  });
  it('flags a frame too tall to stand over and ranks it below one that fits', () => {
    const { frame: _f, mode: _m, locks: _l, current: _c, ...rest } = problem('endurance', frame('endurance-56'));
    const rows = compareFrames(rest, [sized('tall', 640, 400, 600), sized('right', 585, 380, 520)]);
    expect(rows.map((r) => r.frameId)).toEqual(['right', 'tall']);
    expect(rows[0].result.verdict).toBe('fits');
    expect(rows[1].result.verdict).toBe('compromise');
    expect(rows[1].result.flags.join(' ')).toContain('standover');
  });
  it('says no when the bars cannot be reached', () => {
    const far: Frame = { ...frame('race-56'), id: 'far', stack: 480, reach: 520 };
    const r = optimizeFit(problem('endurance', far));
    expect(r.verdict).toBe('no');
  });
});

describe('idealLayout', () => {
  it.each(['endurance', 'sport', 'race', 'gravel'] as StyleId[])('puts every %s metric of both poses in band', (id) => {
    const st = STYLES[id];
    const targets = bandsFor(st, 'medium');
    const ctx = makeContext(null, DEFAULT_COMPONENTS, 'neutral', st.defaultEffort);
    const ideal = idealLayout(segments, targets, poseWeights(st.defaultHands), ctx, DEFAULT_COMPONENTS, DEFAULT_OPTIONS.crankLengths);
    const L = {
      saddle: ideal.saddle, nose: { x: ideal.saddle.x + 150, y: ideal.saddle.y }, hoods: ideal.hoods,
      drops: dropsFromHoods(ideal.hoods, DEFAULT_COMPONENTS), crankLength: ideal.crankLength, cleatOffset: 5,
      stemBase: ideal.hoods, clamp: ideal.hoods, headTop: ideal.hoods, seatAxisTop: ideal.saddle,
    };
    expect(allIn(targets, evaluateFit(segments, L, ctx, targets))).toBe(true);
  });
});

describe('wrenchList', () => {
  it('describes changes', () => {
    expect(wrenchList(DEFAULT_PARAMS, { ...DEFAULT_PARAMS, saddleHeight: 743, stemLength: 110 })).toEqual([
      'Raise the saddle 8 mm',
      'Swap the 100 mm −6° stem for a 110 mm −6° stem',
    ]);
  });
  it('describes cleat moves', () => {
    expect(wrenchList(DEFAULT_PARAMS, { ...DEFAULT_PARAMS, cleatOffset: 10 })).toEqual([
      'Move the cleats 5 mm back toward the midfoot',
    ]);
  });
  it('reports no change', () => {
    expect(wrenchList(DEFAULT_PARAMS, { ...DEFAULT_PARAMS })).toEqual(['No changes from your current setup.']);
  });
});
