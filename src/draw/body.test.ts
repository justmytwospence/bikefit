import { describe, expect, it } from 'vitest';
import { resolveSegments } from '../model/body';
import { forwardLayout } from '../model/geometry';
import { riderPose } from '../model/pose';
import { DEFAULT_COMPONENTS, DEFAULT_PARAMS, EXAMPLE_FRAMES } from '../model/presets';
import { makeContext } from '../model/riding';
import { TEST_BODY } from '../model/testFrames';
import { HEAD_R, headCenter, NECK } from './body';

describe('headCenter', () => {
  it('sits above the shoulder at neck plus head radius', () => {
    const seg = resolveSegments(TEST_BODY);
    const frame = EXAMPLE_FRAMES[1];
    const layout = forwardLayout(frame, DEFAULT_COMPONENTS, DEFAULT_PARAMS);
    const ctx = makeContext(frame, DEFAULT_COMPONENTS, 'neutral', 'easy');
    const p = riderPose(seg, layout, ctx, 'hoods', 158, 270);
    const c = headCenter(p, 1780);
    expect(Math.hypot(c.x - p.shoulder.x, c.y - p.shoulder.y)).toBeCloseTo((NECK + HEAD_R) * 1780, 6);
    expect(c.y).toBeGreaterThan(p.shoulder.y);
    expect(c.y + HEAD_R * 1780).toBeLessThan(0.9 * 1780);
  });
});
