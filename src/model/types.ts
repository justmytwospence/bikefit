import type { Vec2 } from './vec';

export type Flexibility = 'low' | 'medium' | 'high';

export interface Segments {
  femur: number;
  tibia: number;
  ankleHeight: number;
  footBack: number;
  hipUp: number;
  kneeFront: number;
  torso: number;
  upperArm: number;
  forearmGrip: number;
  headRadius: number;
}

/** Physiology, mm. */
export interface Body {
  height: number;
  inseam: number;
  flexibility: Flexibility;
  overrides: Partial<Segments>;
}

export interface Frame {
  id: string;
  name: string;
  stack: number;
  reach: number;
  seatTubeAngle: number;
  headTubeAngle: number;
  headTubeLength: number;
  seatTubeLength: number;
  chainstay: number;
  wheelbase: number;
  bbDrop: number;
  maxSpacers: number;
}

export type CockpitKind = 'dropbar'; // later: 'flatbar' | 'aerobar'

export interface Components {
  cockpit: CockpitKind;
  barReach: number;
  barDrop: number;
  hoodReach: number;
  hoodRise: number;
  headsetCap: number;
  footStack: number;
}

export interface FitParams {
  saddleHeight: number;
  railOffset: number;
  seatpostSetback: number;
  spacers: number;
  stemLength: number;
  stemAngle: number;
  crankLength: number;
}
export type ParamKey = keyof FitParams;

export interface PartOptions {
  stemLengths: number[];
  stemAngles: number[];
  crankLengths: number[];
  seatpostSetbacks: number[];
  saddleHeightRange: [number, number];
  railRange: [number, number];
  spacerStep: number;
}

export interface Layout {
  saddle: Vec2;
  hand: Vec2;
  crankLength: number;
  stemBase: Vec2;
  clamp: Vec2;
  headTop: Vec2;
  seatAxisTop: Vec2;
}

export type MetricId = 'knee' | 'hip' | 'torso' | 'shoulder' | 'elbow' | 'kops';
export interface Band {
  min: number;
  max: number;
  weight: number;
  scale: number;
  unit: '°' | 'mm';
}
export type HandContact = 'hoods'; // later: 'drops' | 'tops' | 'pads'
export interface PoseTarget {
  handContact: HandContact;
  elbowPref: number;
  bands: Record<MetricId, Band>;
  weight: number;
}
export type StyleId = 'endurance' | 'race' | 'gravel';
export interface Style {
  id: StyleId;
  name: string;
  blurb: string;
  cockpit: CockpitKind;
  poses: PoseTarget[];
}
export interface Evaluation {
  metrics: Record<MetricId, number>;
  overextended: boolean;
  overreach: boolean;
  peakKneeCrank: number;
}
