import type { Body, Segments } from './types';

export function resolveSegments(body: Body): Segments {
  const H = body.height;
  const k = body.inseam / (0.47 * H);
  const base: Segments = {
    femur: 0.245 * H * k,
    tibia: 0.246 * H * k,
    ankleHeight: 0.039 * H * k,
    footBack: 0.085 * H,
    hipUp: 0.05 * H,
    kneeFront: 0.022 * H,
    torso: 0.288 * H,
    upperArm: 0.186 * H,
    forearmGrip: 0.189 * H,
    headRadius: 0.06 * H,
  };
  for (const key of Object.keys(body.overrides) as (keyof Segments)[]) {
    const val = body.overrides[key];
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) base[key] = val;
  }
  return base;
}

export const SEGMENT_LABELS: Record<'femur' | 'tibia' | 'torso' | 'upperArm' | 'forearmGrip', string> = {
  femur: 'Thigh (hip to knee)',
  tibia: 'Shin (knee to ankle)',
  torso: 'Torso (hip to shoulder)',
  upperArm: 'Upper arm',
  forearmGrip: 'Forearm to grip',
};
