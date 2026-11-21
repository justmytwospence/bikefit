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

/** Inseam as a share of stature at which torso and arms take their average length: the ratio the style bands were calibrated at (docs/model.md). */
export const INSEAM_SHARE = 0.472;
/**
 * Torso lost and arm gained, mm per mm of inseam beyond INSEAM_SHARE at the same stature. ANSUR II (4,082 men,
 * 1,986 women): acromion height minus trochanterion height falls 0.62 (men) and 0.59 (women) mm per mm of crotch
 * height; shoulder-to-grip length rises 0.34 and 0.43 mm.
 */
export const TORSO_PER_INSEAM = -0.6;
export const ARM_PER_INSEAM = 0.34;
/** Proportions are held within this share of stature of average: ANSUR II spans 0.42 to 0.54, and beyond that a mistyped measurement is likelier. */
export const LEGGY_LIMIT = 0.05;

export function resolveSegments(body: Body): Segments {
  const H = body.height;
  const k = body.inseam / (0.47 * H);
  const f = SEX_FACTORS[body.sex];
  const leggy = Math.min(LEGGY_LIMIT * H, Math.max(-LEGGY_LIMIT * H, body.inseam - INSEAM_SHARE * H));
  const arm = 0.186 * H + 0.189 * H * (f.forearmGrip ?? 1);
  const armScale = (body.armLength ? body.armLength : arm + ARM_PER_INSEAM * leggy) / arm;
  const base = {
    stature: H,
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
    torso: 0.288 * H * (f.torso ?? 1) + TORSO_PER_INSEAM * leggy,
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
