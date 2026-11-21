import { describe, expect, it } from 'vitest';
import { resolveSegments } from '../model/body';
import { forwardLayout } from '../model/geometry';
import { evaluateFit } from '../model/pose';
import { DEFAULT_COMPONENTS, DEFAULT_PARAMS } from '../model/presets';
import { makeContext } from '../model/riding';
import { bandsFor, STYLES } from '../model/styles';
import { TEST_BODY, TEST_FRAMES } from '../model/testFrames';
import { kneeRange } from './kneeRange';

describe('kneeRange', () => {
  const st = STYLES.endurance;
  const seg = resolveSegments(TEST_BODY);
  const targets = bandsFor(st, 'medium', TEST_BODY.height);
  const f = TEST_FRAMES.find((x) => x.id === 'endurance-56')!;
  const pr = { segments: seg, frame: f, components: DEFAULT_COMPONENTS, ankling: 'neutral' as const, effort: st.defaultEffort, targets };
  const knee = (h: number) =>
    evaluateFit(seg, forwardLayout(f, DEFAULT_COMPONENTS, { ...DEFAULT_PARAMS, saddleHeight: h }), makeContext(f, DEFAULT_COMPONENTS, 'neutral', st.defaultEffort), targets, 36, false).poses[0].metrics.knee;
  it('finds the saddle heights that keep the knee in its band, to the millimetre', () => {
    const r = kneeRange(pr, DEFAULT_PARAMS, [550, 900])!;
    expect(r).toEqual([717, 741]);
    const band = targets[0].bands.knee!;
    expect(knee(r[0])).toBeGreaterThanOrEqual(band.min);
    expect(knee(r[0] - 1)).toBeLessThan(band.min);
    expect(knee(r[1])).toBeLessThanOrEqual(band.max);
    expect(knee(r[1] + 1)).toBeGreaterThan(band.max);
  });
  it('does not depend on where the saddle is now', () => {
    expect(kneeRange(pr, { ...DEFAULT_PARAMS, saddleHeight: 600 }, [550, 900])).toEqual([717, 741]);
  });
  it('is null when no height in the range does', () => {
    expect(kneeRange(pr, DEFAULT_PARAMS, [550, 600])).toBeNull();
    expect(kneeRange(pr, DEFAULT_PARAMS, [800, 900])).toBeNull();
  });
});
