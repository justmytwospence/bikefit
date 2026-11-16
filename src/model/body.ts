import type { Body, Segments } from './types';

export function resolveSegments(body: Body): Segments {
  const H = body.height;
  const k = body.inseam / (0.47 * H);
  const armScale = body.armLength ? body.armLength / (0.375 * H) : 1;
  const base = {
    femur: 0.245 * H * k,
    tibia: 0.246 * H * k,
    ankleHeight: 0.039 * H * k,
    footLength: body.shoeSize ? (body.shoeSize * 20) / 3 - 17 : 0.152 * H,
    pelvis: 0.05 * H,
    pelvicShare: { low: 0.35, medium: 0.5, high: 0.6 }[body.flexibility],
    kneeFront: 0.022 * H,
    torso: 0.288 * H,
    upperArm: 0.186 * H * armScale,
    forearmGrip: 0.189 * H * armScale,
    headRadius: 0.06 * H,
  };
  for (const key of Object.keys(body.overrides) as (keyof typeof body.overrides)[]) {
    const val = body.overrides[key];
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) base[key] = val;
  }
  return { ...base, footBack: 0.55 * base.footLength, toeAhead: 0.28 * base.footLength + 15 };
}

export const SEGMENT_LABELS: Record<
  'femur' | 'tibia' | 'torso' | 'upperArm' | 'forearmGrip' | 'footLength',
  string
> = {
  femur: 'Thigh (hip to knee)',
  tibia: 'Shin (knee to ankle)',
  torso: 'Torso (hip to shoulder)',
  upperArm: 'Upper arm',
  forearmGrip: 'Forearm to grip',
  footLength: 'Foot length (heel to longest toe)',
};
