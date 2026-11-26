import { describe, expect, it } from 'vitest';
import { resolveSegments } from './body';
import { fittedStyle, reportPosition } from './fitReport';
import { dropsFromHoods, forwardLayout } from './geometry';
import { changeList, wrenchList } from './advice';
import { byVerdictThenCost, compareFrames, costOf, idealLayout, optimizeFit, optimizeSizes, type FitProblem } from './optimize';
import { presetLocks } from '../lib/knobs';
import { standoverHeight } from './verdict';
import { POST_SHOWING } from './limits';
import { evaluateFit } from './pose';
import { TEST_BODY, TEST_FRAMES } from './testFrames';
import { DEFAULT_BODY, DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS } from './presets';
import { makeContext, poseWeights } from './riding';
import { outside } from './score';
import { bandsFor, STYLES } from './styles';
import type { Body, Evaluation, Frame, MetricId, PoseTarget, BaseStyleId } from './types';

const segments = resolveSegments(TEST_BODY);
const frame = (id: string) => TEST_FRAMES.find((f) => f.id === id)!;

function problem(style: BaseStyleId, f: Frame, mode: 'shop' | 'tune' = 'shop'): FitProblem {
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
  it('keeps the seatpost inside what a post can do on a far too small frame', () => {
    const tiny = { ...frame('race-54'), seatTubeLength: 360 };
    const r = optimizeFit(problem('endurance', tiny));
    expect(r.params.saddleHeight - tiny.seatTubeLength).toBeLessThanOrEqual(POST_SHOWING[1]);
    const tall = { ...frame('endurance-56'), seatTubeLength: 740 };
    const t = optimizeFit(problem('endurance', tall));
    expect(t.params.saddleHeight - tall.seatTubeLength).toBeGreaterThanOrEqual(POST_SHOWING[0]);
    // A 740 mm seat tube puts the top tube far above the rider's inseam.
    expect(t.verdict).toBe('no');
    // 30 mm of post on this seat tube puts the saddle beyond the test rider's legs: nothing works.
    const huge = { ...frame('endurance-56'), seatTubeLength: 780 };
    expect(optimizeFit(problem('endurance', huge)).verdict).toBe('no');
  });
  it('fits endurance on the endurance frame', () => {
    const p = problem('endurance', frame('endurance-56'));
    const t = performance.now();
    const r = optimizeFit(p);
    // A guard against the optimizer getting several times slower, not a benchmark: CI runners take about 1.6 s.
    expect(performance.now() - t).toBeLessThan(3000);
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
  it('levels a nose-down saddle in the tools step', () => {
    const current = { ...DEFAULT_PARAMS, saddleTilt: -6 };
    const p = { ...problem('endurance', frame('endurance-56'), 'tune'), baseline: current, current, locks: presetLocks('tools') };
    expect(Math.abs(optimizeFit(p).params.saddleTilt)).toBeLessThanOrEqual(1.5);
  });
  it('never changes bar rotation', () => {
    const current = { ...DEFAULT_PARAMS, barRoll: 4 };
    const t = optimizeFit({ ...problem('endurance', frame('endurance-56'), 'tune'), baseline: current, current });
    expect(t.params.barRoll).toBe(4);
    expect(optimizeFit(problem('endurance', frame('endurance-56'))).params.barRoll).toBe(0);
  });
  it('My fit targets reproduce the report on another bike', () => {
    const report = { label: '', saddleHeight: 698, seatAngle: 74, saddleSetback: -59, saddleAngle: 0, gripReach: 550, gripDrop: -14, crankLength: 172.5 };
    const comp = { ...DEFAULT_COMPONENTS, hoodReach: 22, hoodRise: 28 };
    const grizl: Frame = {
      id: 'grizl-s', name: 'Grizl S', stack: 556, reach: 397, seatTubeAngle: 73.5, headTubeAngle: 71, headTubeLength: 118,
      seatTubeLength: 492, chainstay: 435, wheelbase: 1036, bbDrop: 75, maxSpacers: 40, tyreWidth: 40,
    };
    const body = { ...DEFAULT_BODY, height: 1750, inseam: 805, ankling: 'toePoint' as const };
    const seg = resolveSegments(body);
    const fitted = fittedStyle(report, seg, comp, 'toePoint', 'tempo').style!;
    const pos = reportPosition(report, comp);
    const start = { ...DEFAULT_PARAMS, crankLength: 172.5 };
    const r = optimizeFit({
      segments: seg, inseam: 805, targets: bandsFor(fitted, 'medium'), poseWeights: poseWeights('hoods'), ankling: 'toePoint',
      effort: 'tempo', frame: grizl, components: comp, options: DEFAULT_OPTIONS, baseline: start, current: start, locks: {},
      mode: 'tune', crankRef: 172.5,
    });
    const L = forwardLayout(grizl, comp, r.params);
    expect(Math.hypot(L.hoods.x - pos.hoods.x, L.hoods.y - pos.hoods.y)).toBeLessThan(8);
    expect(Math.hypot(L.saddle.x - pos.saddle.x, L.saddle.y - pos.saddle.y)).toBeLessThan(3);
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
  it('allows 20 mm for shoes before calling the standover tight', () => {
    const snug = optimizeFit(problem('endurance', sized('snug', 595, 383, 602)));
    expect(snug.facts.standover).toBeGreaterThan(0);
    expect(snug.facts.standover).toBeLessThan(20);
    expect(snug.flags.join(' ')).not.toContain('Standover');
    const tight = optimizeFit(problem('endurance', sized('tight', 595, 383, 660)));
    expect(tight.facts.standover).toBeLessThan(0);
    expect(tight.flags.join(' ')).toContain('Standover');
  });
  it('flags a frame too tall to stand over and ranks it below one that fits', () => {
    const { frame: _f, mode: _m, locks: _l, current: _c, ...rest } = problem('endurance', frame('endurance-56'));
    const rows = compareFrames(rest, [sized('tall', 640, 400, 600), sized('right', 585, 380, 520)]);
    expect(rows.map((r) => r.frameId)).toEqual(['right', 'tall']);
    expect(rows[0].result.verdict).toBe('fits');
    expect(rows[1].result.verdict).toBe('compromise');
    expect(rows[1].result.flags.join(' ')).toContain('Standover');
  });
  it('optimizes sizes best first and keeps locks', () => {
    const base = problem('endurance', frame('endurance-56'));
    const p = { ...base, locks: { crankLength: true }, current: { ...DEFAULT_PARAMS, crankLength: 170 } };
    const rows = optimizeSizes(p, [sized('tall', 640, 400, 600), sized('right', 585, 380, 520)]);
    expect(rows.map((r) => r.frameId)).toEqual(['right', 'tall']);
    expect([...rows].sort(byVerdictThenCost).map((r) => r.frameId)).toEqual(['right', 'tall']);
    for (const r of rows) expect(r.result.params.crankLength).toBe(170);
  });
  it('says no when the bars cannot be reached', () => {
    const far: Frame = { ...frame('race-56'), id: 'far', stack: 480, reach: 520 };
    const r = optimizeFit(problem('endurance', far));
    expect(r.verdict).toBe('no');
  });
});

describe('idealLayout', () => {
  it.each(['endurance', 'sport', 'race', 'gravel'] as BaseStyleId[])('puts every %s metric of both poses in band', (id) => {
    const st = STYLES[id];
    const targets = bandsFor(st, 'medium');
    const ctx = makeContext(null, DEFAULT_COMPONENTS, 'neutral', st.defaultEffort);
    const ideal = idealLayout(segments, targets, poseWeights(st.defaultHands), ctx, DEFAULT_COMPONENTS, DEFAULT_OPTIONS.crankLengths, TEST_BODY.inseam);
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
  it('marks a big saddle move for staging', () => {
    const staged = 'A big move: make it about 5 mm at a time, a few rides apart.';
    expect(changeList(DEFAULT_PARAMS, { ...DEFAULT_PARAMS, saddleHeight: 755 })[0].note).toBe(staged);
    expect(changeList(DEFAULT_PARAMS, { ...DEFAULT_PARAMS, saddleHeight: 743 })[0].note).toBeUndefined();
    expect(changeList(DEFAULT_PARAMS, { ...DEFAULT_PARAMS, railOffset: -12 })[0].note).toBe(staged);
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

describe('cranks in proportion to the legs (optimizer)', () => {
  const rider = (style: BaseStyleId, body: Body) => {
    const st = STYLES[style];
    return {
      segments: resolveSegments(body), inseam: body.inseam, targets: bandsFor(st, body.flexibility, body.height),
      poseWeights: poseWeights(st.defaultHands), ankling: 'neutral' as const, effort: st.defaultEffort,
      components: DEFAULT_COMPONENTS, options: DEFAULT_OPTIONS, baseline: DEFAULT_PARAMS, stock: st.stock,
    };
  };
  const small: Body = { ...TEST_BODY, sex: 'female', height: 1580, inseam: 720, shoeSize: 38 };
  it('the ideal position of a small rider uses a short crank and an ordinary seat angle', () => {
    const r = rider('endurance', small);
    const ideal = idealLayout(r.segments, r.targets, r.poseWeights, makeContext(null, DEFAULT_COMPONENTS, 'neutral', r.effort), DEFAULT_COMPONENTS, DEFAULT_OPTIONS.crankLengths, small.inseam);
    expect(ideal.crankLength).toBe(150);
    const seatAngle = (Math.atan2(ideal.saddle.y, -ideal.saddle.x) * 180) / Math.PI;
    expect(seatAngle).toBeGreaterThan(72);
    expect(seatAngle).toBeLessThan(74.5);
  });
  it('the ideal position of the default rider keeps a 172.5 mm crank', () => {
    const r = rider('endurance', TEST_BODY);
    const ideal = idealLayout(r.segments, r.targets, r.poseWeights, makeContext(null, DEFAULT_COMPONENTS, 'neutral', r.effort), DEFAULT_COMPONENTS, DEFAULT_OPTIONS.crankLengths, TEST_BODY.inseam);
    expect(ideal.crankLength).toBe(172.5);
  });
  it('does not shorten the cranks to make up for a frame that is too tall', () => {
    const odd: Frame = { ...frame('race-56'), id: 'odd', stack: 650, reach: 340 };
    const p: FitProblem = { ...rider('race', TEST_BODY), frame: odd, current: DEFAULT_PARAMS, locks: {}, mode: 'shop' };
    expect([170, 172.5, 175]).toContain(optimizeFit(p).params.crankLength);
  });
  it('a small rider fits a small frame once the cranks suit her legs', () => {
    const domane47: Frame = {
      id: 'domane-47', name: 'domane 47', stack: 527, reach: 364, seatTubeAngle: 74.6, headTubeAngle: 71, headTubeLength: 110,
      seatTubeLength: 420, chainstay: 420, wheelbase: 986, bbDrop: 80, maxSpacers: 40, tyreWidth: 32,
    };
    const r = rider('endurance', small);
    const locks = { crankLength: true };
    const long = compareFrames(r, [domane47], locks)[0].result;
    const right = compareFrames({ ...r, baseline: { ...DEFAULT_PARAMS, crankLength: 150 } }, [domane47], locks)[0].result;
    expect(right.params.crankLength).toBe(150);
    expect(right.score).toBeGreaterThanOrEqual(long.score + 10);
    expect(right.verdict).toBe('fits');
  });
});


describe('crank swaps on a bike you ride', () => {
  const tune = (body: Body, f: Frame, setup: Partial<typeof DEFAULT_PARAMS>): FitProblem => {
    const st = STYLES.endurance;
    const cur = { ...DEFAULT_PARAMS, ...setup };
    return {
      segments: resolveSegments(body), inseam: body.inseam, targets: bandsFor(st, 'medium', body.height), poseWeights: poseWeights(st.defaultHands),
      ankling: 'neutral', effort: st.defaultEffort, frame: f, components: DEFAULT_COMPONENTS, options: DEFAULT_OPTIONS,
      baseline: cur, current: cur, locks: {}, mode: 'tune', stock: st.stock,
    };
  };
  it('suggests shorter cranks to a small rider on long ones', () => {
    const domane47: Frame = {
      id: 'domane-47', name: 'domane 47', stack: 527, reach: 364, seatTubeAngle: 74.6, headTubeAngle: 71, headTubeLength: 110,
      seatTubeLength: 420, chainstay: 420, wheelbase: 986, bbDrop: 80, maxSpacers: 40, tyreWidth: 32,
    };
    const body: Body = { ...DEFAULT_BODY, sex: 'female', height: 1580, inseam: 720 };
    const r = optimizeFit(tune(body, domane47, { saddleHeight: 600, stemLength: 80, crankLength: 170, spacers: 20 }));
    expect(r.params.crankLength).toBe(150);
  });
  it('leaves the cranks of an average rider alone', () => {
    const r = optimizeFit(tune(DEFAULT_BODY, frame('endurance-56'), { saddleHeight: 705 }));
    expect(r.params.crankLength).toBe(172.5);
  });
});

