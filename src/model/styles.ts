import type { Band, Flexibility, MetricId, PoseTarget, Style, StyleId } from './types';

const W: Record<MetricId, number> = {
  knee: 1, kneeTop: 0.5, hip: 0.6, torso: 1, shoulder: 0.6, elbow: 0, seatAngle: 0.4, handLoad: 0.5, kops: 0,
};

function band(k: MetricId, r: [number, number]): Band {
  return {
    min: r[0],
    max: r[1],
    weight: W[k],
    scale: k === 'kops' ? 10 : k === 'seatAngle' ? 1.5 : k === 'handLoad' ? 4 : 5,
    center: k === 'kneeTop' ? 0 : 0.05,
    unit: k === 'kops' ? 'mm' : k === 'handLoad' ? '%' : '°',
  };
}

function bands(r: Partial<Record<MetricId, [number, number]>>): Partial<Record<MetricId, Band>> {
  const out: Partial<Record<MetricId, Band>> = {};
  for (const k of Object.keys(r) as MetricId[]) out[k] = band(k, r[k]!);
  return out;
}

function style(
  id: StyleId, name: string, blurb: string, defaults: Pick<Style, 'defaultEffort' | 'defaultHands'>,
  hoodsElbow: number,
  hoods: Partial<Record<MetricId, [number, number]>>,
  drops: Partial<Record<MetricId, [number, number]>>,
): Style {
  return {
    id, name, blurb, cockpit: 'dropbar', ...defaults,
    poses: [
      { handContact: 'hoods', elbowPref: hoodsElbow, bands: bands(hoods) },
      { handContact: 'drops', elbowPref: 140, bands: bands(drops) },
    ],
  };
}

/** Band centres are anchored on stock builds of manufacturer-recommended sizes; see docs/model.md and sizing.test.ts. */
export const STYLES: Record<StyleId, Style> = {
  endurance: style(
    'endurance', 'Relaxed', 'Upright and comfortable for long days, like an endurance bike.',
    { defaultEffort: 'easy', defaultHands: 'hoods' }, 158,
    {
      knee: [140, 150], kneeTop: [62, 120], hip: [58, 76], torso: [46.5, 54.5], shoulder: [78, 90],
      elbow: [150, 165], seatAngle: [71, 75], handLoad: [19, 31], kops: [-10, 40],
    },
    { hip: [47, 65], torso: [35, 45], shoulder: [73, 89], elbow: [125, 155], handLoad: [24, 38] },
  ),
  sport: style(
    'sport', 'Sporty', 'A moderate drop for fast group rides.',
    { defaultEffort: 'tempo', defaultHands: 'hoods' }, 156,
    {
      knee: [140, 150], kneeTop: [62, 120], hip: [54, 72], torso: [42, 50], shoulder: [80, 92],
      elbow: [150, 165], seatAngle: [71.5, 75.5], handLoad: [18, 30], kops: [-10, 40],
    },
    { hip: [43, 61], torso: [30.5, 40.5], shoulder: [76, 92], elbow: [125, 155], handLoad: [22, 36] },
  ),
  race: style(
    'race', 'Aggressive', 'Low and long for racing.',
    { defaultEffort: 'hard', defaultHands: 'mixed' }, 155,
    {
      knee: [140, 150], kneeTop: [62, 120], hip: [52, 70], torso: [39.5, 47.5], shoulder: [83, 95],
      elbow: [150, 165], seatAngle: [72, 76], handLoad: [16, 28], kops: [-10, 40],
    },
    { hip: [41, 59], torso: [28, 38], shoulder: [78, 94], elbow: [125, 155], handLoad: [20, 34] },
  ),
  gravel: style(
    'gravel', 'Gravel', 'Stable and a little more upright for rough ground.',
    { defaultEffort: 'tempo', defaultHands: 'hoods' }, 155,
    {
      knee: [138, 148], kneeTop: [62, 120], hip: [56, 74], torso: [45, 53], shoulder: [79, 91],
      elbow: [148, 162], seatAngle: [71.5, 75.5], handLoad: [17, 29], kops: [-15, 40],
    },
    { hip: [46, 64], torso: [34, 44], shoulder: [73, 89], elbow: [125, 155], handLoad: [21, 35] },
  ),
};

export function bandsFor(style: Style, flexibility: Flexibility): PoseTarget[] {
  const shift = flexibility === 'low' ? 3 : flexibility === 'high' ? -2 : 0;
  return style.poses.map((p) => {
    const b: Partial<Record<MetricId, Band>> = {};
    for (const k of Object.keys(p.bands) as MetricId[]) {
      const src = p.bands[k]!;
      b[k] = { ...src };
      if (shift && (k === 'torso' || k === 'hip')) {
        b[k]!.min += shift;
        b[k]!.max += shift;
      }
    }
    return { handContact: p.handContact, elbowPref: p.elbowPref, bands: b };
  });
}

export const METRIC_LABELS: Record<MetricId, { short: string; long: string }> = {
  knee: { short: 'Knee', long: 'Knee extension (most open point of the stroke)' },
  kneeTop: { short: 'Knee (top)', long: 'Knee angle at the top of the stroke (most closed)' },
  hip: { short: 'Hip', long: 'Hip angle (most closed point)' },
  torso: { short: 'Torso', long: 'Torso angle from horizontal' },
  shoulder: { short: 'Shoulder', long: 'Shoulder angle' },
  elbow: { short: 'Elbow', long: 'Elbow angle (the model assumes this bend; shown for reference)' },
  seatAngle: { short: 'Seat angle', long: 'Effective seat angle: bottom bracket to saddle, from horizontal' },
  handLoad: { short: 'Hand load', long: 'Estimated share of body weight on the hands at your effort level. It follows saddle setback and effort; stem changes barely move it.' },
  kops: { short: 'Knee/pedal', long: "Knee ahead of the pedal axle at 3 o'clock (for information)" },
};

export const METRIC_ORDER: MetricId[] = [
  'knee', 'kneeTop', 'hip', 'torso', 'shoulder', 'elbow', 'seatAngle', 'handLoad', 'kops',
];
export const SIMPLE_METRICS: MetricId[] = ['knee', 'hip', 'torso', 'handLoad'];
