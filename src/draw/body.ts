import type { RiderPose } from '../model/pose';
import { add, rad, scale, type Vec2 } from '../model/vec';

/** Technical line-diagram rider: the fit model's skeleton plus a head circle. */
export const HEAD_R = 0.058; // x height
export const NECK = 0.06; // shoulder to head edge, x height
export const HEAD_PITCH = 0.2;
export const HEAD_REST_LEAN = 7;

/** Head centre placed above the shoulder, looking up the road. */
export function headCenter(pose: RiderPose, H: number): Vec2 {
  const ang = 90 - HEAD_REST_LEAN - HEAD_PITCH * (90 - pose.torsoAngle);
  const u = { x: Math.cos(rad(ang)), y: Math.sin(rad(ang)) };
  return add(pose.shoulder, scale(u, (NECK + HEAD_R) * H));
}
