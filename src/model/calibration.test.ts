import { describe, expect, it } from 'vitest';
import { resolveSegments } from './body';
import { forwardLayout } from './geometry';
import { optimizeFit, type FitProblem } from './optimize';
import { evaluateFit } from './pose';
import { DEFAULT_BODY, DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS } from './presets';
import { TEST_FRAMES } from './testFrames';
import { makeContext, poseWeights } from './riding';
import { bandsFor, STYLES } from './styles';
import type { Body } from './types';

/**
 * The model is not tuned to these numbers; they are independent published observations it has to
 * reproduce. Sources are listed in README.md under "Where the numbers come from".
 */
const frame = TEST_FRAMES.find((f) => f.id === 'endurance-56')!;
const ANSUR_MAN: Body = { ...DEFAULT_BODY, height: 1756, inseam: 846, shoeSize: 43, shoeSizeAuto: false };
const ANSUR_WOMAN: Body = { ...DEFAULT_BODY, sex: 'female', height: 1629, inseam: 782, shoeSize: 39, shoeSizeAuto: false };
const DEFAULT_MAN: Body = { ...DEFAULT_BODY, shoeSize: 43, shoeSizeAuto: false };

function flexionAt(body: Body, saddleHeight: number, crankLength: number): number {
  const st = STYLES.endurance;
  const targets = bandsFor(st, 'medium');
  const layout = forwardLayout(frame, DEFAULT_COMPONENTS, { ...DEFAULT_PARAMS, saddleHeight, crankLength });
  const ctx = makeContext(frame, DEFAULT_COMPONENTS, 'neutral', st.defaultEffort);
  return 180 - evaluateFit(resolveSegments(body), layout, ctx, targets).poses[0].metrics.knee;
}
function optimum(body: Body, crankLength: number): number {
  const st = STYLES.endurance;
  const current = { ...DEFAULT_PARAMS, crankLength };
  const p: FitProblem = {
    segments: resolveSegments(body), inseam: body.inseam, targets: bandsFor(st, 'medium'),
    poseWeights: poseWeights(st.defaultHands), ankling: 'neutral', effort: st.defaultEffort, frame,
    components: DEFAULT_COMPONENTS, options: DEFAULT_OPTIONS, baseline: current, current,
    locks: { crankLength: true, cleatOffset: true }, mode: 'shop',
  };
  return optimizeFit(p).params.saddleHeight;
}

describe('saddle height against published observations', () => {
  // Peveler 2005: 0.883 x inseam gives 24 deg static knee flexion; Bini and Hume 2016 and
  // Millour 2019: pedalling adds about 8 deg. Millour 2021: 30 to 40 deg for inseams of 0.80 to 0.88 m.
  it.each([
    ['ANSUR II mean man', ANSUR_MAN],
    ['default rider', DEFAULT_MAN],
  ] as [string, Body][])('%s at 0.883 x inseam pedals with 28 to 36 deg of knee flexion', (_n, body) => {
    const f = flexionAt(body, 0.883 * body.inseam, 172.5);
    expect(f).toBeGreaterThan(28);
    expect(f).toBeLessThan(36);
  });
  it('ANSUR II mean woman at 109% of inseam (170 mm cranks) has 24 to 36 deg', () => {
    const f = flexionAt(ANSUR_WOMAN, 1.09 * ANSUR_WOMAN.inseam - 170, 170);
    expect(f).toBeGreaterThan(24);
    expect(f).toBeLessThan(36);
  });
  // The published dynamic range centres on 35 deg, a little more bent than the 0.883 rule gives,
  // so the optimum sits just under the rule.
  it.each([
    ['ANSUR II mean man', ANSUR_MAN, 172.5, 0.855, 0.885],
    ['default rider', DEFAULT_MAN, 172.5, 0.855, 0.885],
    ['tall rider', { ...DEFAULT_MAN, height: 1930, inseam: 920, shoeSize: 46 }, 175, 0.865, 0.9],
    ['small rider', { ...ANSUR_WOMAN, height: 1600, inseam: 740, shoeSize: 38 }, 165, 0.835, 0.875],
  ] as [string, Body, number, number, number][])('%s optimum is near the inseam rules', (_n, body, crank, lo, hi) => {
    const ratio = optimum(body, crank) / body.inseam;
    expect(ratio).toBeGreaterThan(lo);
    expect(ratio).toBeLessThan(hi);
  });
});
