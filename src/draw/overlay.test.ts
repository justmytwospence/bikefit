import { describe, expect, it } from 'vitest';
import type { LinkId } from '../lib/linkIds';
import { resolveSegments } from '../model/body';
import { forwardLayout } from '../model/geometry';
import { evaluateFit, riderPose } from '../model/pose';
import { DEFAULT_COMPONENTS, DEFAULT_PARAMS } from '../model/presets';
import { makeContext } from '../model/riding';
import { bandsFor, STYLES } from '../model/styles';
import { TEST_BODY, TEST_FRAMES } from '../model/testFrames';
import { overlayFor, type OverlayInput } from './overlay';

const frame = TEST_FRAMES.find((f) => f.id === 'endurance-56')!;
const seg = resolveSegments(TEST_BODY);
const layout = forwardLayout(frame, DEFAULT_COMPONENTS, DEFAULT_PARAMS);
const ctx = makeContext(frame, DEFAULT_COMPONENTS, 'neutral', 'easy');
const targets = bandsFor(STYLES.endurance, 'medium');
const ev = evaluateFit(seg, layout, ctx, targets);
const pose = riderPose(seg, layout, ctx, 'hoods', targets[0].elbowPref, ev.peakKneeCrank);
const base: Omit<OverlayInput, 'id'> = {
  layout, frame, components: DEFAULT_COMPONENTS, params: DEFAULT_PARAMS, pose, poseEval: ev.poses[0], seg,
  toe: pose.toe, toeClearance: 20, units: 'metric',
};
const at = (id: LinkId, extra: Partial<OverlayInput> = {}) => overlayFor({ ...base, ...extra, id });

const ALL: LinkId[] = [
  'saddleHeight', 'setback', 'cleat', 'spacers', 'stem', 'crank',
  'm:knee', 'm:kneeTop', 'm:hip', 'm:torso', 'm:shoulder', 'm:elbow', 'm:seatAngle', 'm:handLoad', 'm:kops',
  'f:stack', 'f:reach', 'f:seatTubeAngle', 'f:headTubeAngle', 'f:headTubeLength', 'f:seatTubeLength', 'f:chainstay',
  'f:wheelbase', 'f:bbDrop', 'f:maxSpacers', 'f:tyreWidth',
  'c:barReach', 'c:barDrop', 'c:saddleLength', 'c:footStack', 'c:headsetCap', 'c:hoodReach', 'c:hoodRise',
  'b:height', 'b:inseam', 'b:arm', 'b:femur', 'b:tibia', 'b:torso', 'b:upperArm', 'b:forearmGrip', 'b:footLength', 'b:shoe',
  'r:reach', 'r:drop', 'r:toe', 'r:hoods',
];

describe('overlayFor', () => {
  it('angles the arcs already show have no overlay', () => {
    for (const id of ['m:knee', 'm:hip', 'm:torso'] as LinkId[]) expect(at(id)).toBeNull();
  });
  it('stack is a vertical dimension at the head tube', () => {
    const o = at('f:stack')!;
    expect(o.label).toBe(`Stack ${frame.stack} mm`);
    const d = o.dims[0];
    expect(d.a.x).toBeCloseTo(d.b.x, 6);
    expect(Math.abs(d.b.y - d.a.y)).toBeCloseTo(frame.stack, 6);
  });
  it('thigh covers hip to knee in the rider\'s units', () => {
    const o = at('b:femur')!;
    expect(o.strong).toEqual([[pose.hip, pose.knee]]);
    expect(o.label.endsWith(' mm')).toBe(true);
    expect(at('b:femur', { units: 'imperial' })!.label.endsWith(' in')).toBe(true);
  });
  it('toe clearance needs a toe', () => {
    expect(at('r:toe', { toe: null })).toBeNull();
  });
  it('every id returns without throwing', () => {
    for (const id of ALL) expect(() => at(id)).not.toThrow();
  });
});
