import type { Body, Segments, Sex } from './types';

/** Female proportions relative to male for the same height (ANSUR II means). */
export const SEX_FACTORS: Record<
  Sex,
  Partial<Record<'torso' | 'forearmGrip' | 'femur' | 'tibia' | 'ankleHeight', number>>
> = {
  male: {},
  female: { torso: 0.978, forearmGrip: 0.982, femur: 0.989, tibia: 1.009, ankleHeight: 0.928 },
};

/** EU shoe size suggested from sex and height (foot length regressions from ANSUR II). */
export function suggestShoeSize(sex: Sex, height: number): number {
  const footLength = sex === 'female' ? 18.5 + 0.1399 * height : 30.1 + 0.1373 * height;
  const eu = Math.round(((footLength + 17) * 3) / 20 * 2) / 2;
  return Math.min(50, Math.max(36, eu));
}

export function effectiveShoeSize(body: Body): number {
  return body.shoeSizeAuto ? suggestShoeSize(body.sex, body.height) : body.shoeSize;
}

export function resolveSegments(body: Body): Segments {
  const H = body.height;
  const k = body.inseam / (0.47 * H);
  const f = SEX_FACTORS[body.sex];
  const arm = 0.186 * H + 0.189 * H * (f.forearmGrip ?? 1);
  const armScale = body.armLength ? body.armLength / arm : 1;
  const base = {
    femur: 0.245 * H * k * (f.femur ?? 1),
    tibia: 0.246 * H * k * (f.tibia ?? 1),
    ankleHeight: 0.039 * H * k * (f.ankleHeight ?? 1),
    footLength: (effectiveShoeSize(body) * 20) / 3 - 17,
    // Sit bones to hip joint centre in the pelvis frame (Peng et al. 2013, CT of 48 pelves: 67.9 mm up,
    // 31.2 mm forward), as fractions of the ANSUR II mean male stature (1756 mm).
    pelvisUp: 0.0387 * H,
    pelvisFwd: 0.0178 * H,
    pelvicShare: { low: 0.35, medium: 0.5, high: 0.6 }[body.flexibility],
    kneeFront: 0.022 * H,
    torso: 0.288 * H * (f.torso ?? 1),
    upperArm: 0.186 * H * armScale,
    forearmGrip: 0.189 * H * (f.forearmGrip ?? 1) * armScale,
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
