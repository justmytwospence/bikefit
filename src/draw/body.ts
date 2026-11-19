import type { RiderPose } from '../model/pose';
import { add, rad, scale, type Vec2 } from '../model/vec';

/** Technical line-diagram rider: the fit model's skeleton plus a head circle. */
export const HEAD_R = 0.058; // x height
export const NECK = 0.06; // shoulder to head edge, x height

/** Head centre on the line of the torso, beyond the shoulder. */
export function headCenter(pose: RiderPose, H: number): Vec2 {
  const u = { x: Math.cos(rad(pose.torsoAngle)), y: Math.sin(rad(pose.torsoAngle)) };
  return add(pose.shoulder, scale(u, (NECK + HEAD_R) * H));
}
