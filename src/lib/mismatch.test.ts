import { describe, expect, it } from 'vitest';
import { DEFAULT_COMPONENTS, DEFAULT_PARAMS } from '../model/presets';
import { bandsFor, STYLES } from '../model/styles';
import { TEST_BODY, TEST_FRAMES } from '../model/testFrames';
import { bodyMismatch } from './mismatch';

const st = STYLES.endurance;
const pr = {
  frame: TEST_FRAMES.find((f) => f.id === 'endurance-56')!, components: DEFAULT_COMPONENTS, ankling: 'neutral' as const,
  effort: st.defaultEffort, targets: bandsFor(st, 'medium'),
};
const high = { ...DEFAULT_PARAMS, saddleHeight: 880 };

describe('bodyMismatch', () => {
  it('a sensible setup is no mismatch', () => {
    expect(bodyMismatch(pr, TEST_BODY, DEFAULT_PARAMS)).toBeNull();
  });
  it('a saddle far too high is one and suggests a longer inseam', () => {
    const m = bodyMismatch(pr, TEST_BODY, high)!;
    expect(m).not.toBeNull();
    expect(m.over).toBe(true);
    expect(m.inseam).toBeGreaterThan(TEST_BODY.inseam);
    expect(bodyMismatch(pr, { ...TEST_BODY, inseam: m.inseam! }, high)).toBeNull();
  });
  it('entered leg lengths get no inseam suggestion', () => {
    expect(bodyMismatch(pr, { ...TEST_BODY, overrides: { femur: 400 } }, high)!.inseam).toBeNull();
  });
});
