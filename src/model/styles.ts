import type { Band, Flexibility, MetricId, Style, StyleId } from './types';

const W: Record<MetricId, number> = { knee: 1, hip: 0.6, torso: 1, shoulder: 0.6, elbow: 0.4, kops: 0.3 };

function bands(r: Record<MetricId, [number, number]>): Record<MetricId, Band> {
  const out = {} as Record<MetricId, Band>;
  for (const k of Object.keys(r) as MetricId[]) {
    out[k] = {
      min: r[k][0],
      max: r[k][1],
      weight: W[k],
      scale: k === 'kops' ? 10 : 5,
      unit: k === 'kops' ? 'mm' : '°',
    };
  }
  return out;
}

function style(id: StyleId, name: string, blurb: string, elbowPref: number, r: Record<MetricId, [number, number]>): Style {
  return {
    id,
    name,
    blurb,
    cockpit: 'dropbar',
    poses: [{ handContact: 'hoods', elbowPref, bands: bands(r), weight: 1 }],
  };
}

export const STYLES: Record<StyleId, Style> = {
  endurance: style('endurance', 'Endurance', 'Upright and comfortable for long days.', 158, {
    knee: [140, 148], hip: [55, 75], torso: [45, 55], shoulder: [80, 92], elbow: [150, 165], kops: [-10, 20],
  }),
  race: style('race', 'Race', 'Low and long for speed.', 155, {
    knee: [140, 148], hip: [45, 62], torso: [32, 42], shoulder: [88, 100], elbow: [150, 165], kops: [-10, 20],
  }),
  gravel: style('gravel', 'Gravel', 'Stable and a little more upright for rough ground.', 155, {
    knee: [138, 146], hip: [50, 70], torso: [40, 50], shoulder: [82, 95], elbow: [148, 162], kops: [-15, 15],
  }),
};

export function bandsFor(style: Style, flexibility: Flexibility): Record<MetricId, Band> {
  const src = style.poses[0].bands;
  const out = {} as Record<MetricId, Band>;
  for (const k of Object.keys(src) as MetricId[]) out[k] = { ...src[k] };
  const shift = flexibility === 'low' ? 5 : flexibility === 'high' ? -3 : 0;
  if (shift) {
    for (const k of ['torso', 'hip'] as const) {
      out[k].min += shift;
      out[k].max += shift;
    }
  }
  return out;
}

export const METRIC_LABELS: Record<MetricId, { short: string; long: string }> = {
  knee: { short: 'Knee', long: 'Knee extension (most open point of the stroke)' },
  hip: { short: 'Hip', long: 'Hip angle (most closed point)' },
  torso: { short: 'Torso', long: 'Torso angle from horizontal' },
  shoulder: { short: 'Shoulder', long: 'Shoulder angle' },
  elbow: { short: 'Elbow', long: 'Elbow angle' },
  kops: { short: 'Knee/pedal', long: 'Knee ahead of pedal at 3 o\'clock' },
};

export const METRIC_ORDER: MetricId[] = ['knee', 'hip', 'torso', 'shoulder', 'elbow', 'kops'];
