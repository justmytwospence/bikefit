import type { Vec2 } from './vec';

export type Flexibility = 'low' | 'medium' | 'high';
export type Sex = 'male' | 'female';
export type Ankling = 'heelDrop' | 'neutral' | 'toePoint';
export type Effort = 'easy' | 'tempo' | 'hard';
export type HandsPref = 'hoods' | 'mixed' | 'drops';

export interface Segments {
  femur: number;
  tibia: number;
  ankleHeight: number;
  footLength: number;
  footBack: number;
  toeAhead: number;
  pelvis: number;
  pelvicShare: number;
  kneeFront: number;
  torso: number;
  upperArm: number;
  forearmGrip: number;
  headRadius: number;
}

export type SegmentOverrides = Partial<
  Pick<Segments, 'femur' | 'tibia' | 'torso' | 'upperArm' | 'forearmGrip' | 'footLength'>
>;

/** Physiology, mm. */
export interface Body {
  height: number;
  inseam: number;
  flexibility: Flexibility;
  /** EU shoe size; people know this, so it is asked for rather than estimated. */
  shoeSize: number;
  /** While true the shoe size follows sex and height; picking a size turns it off. */
  shoeSizeAuto: boolean;
  sex: Sex;
  armLength: number | null;
  ankling: Ankling;
  overrides: SegmentOverrides;
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
  tyreWidth: number;
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
  saddleLength: number;
}

export interface FitParams {
  saddleHeight: number;
  railOffset: number;
  seatpostSetback: number;
  spacers: number;
  stemLength: number;
  stemAngle: number;
  crankLength: number;
  cleatOffset: number;
}
export type ParamKey = keyof FitParams;

export interface PartOptions {
  stemLengths: number[];
  stemAngles: number[];
  crankLengths: number[];
  seatpostSetbacks: number[];
  saddleHeightRange: [number, number];
  railRange: [number, number];
  cleatRange: [number, number];
  spacerStep: number;
}

export interface Layout {
  saddle: Vec2;
  nose: Vec2;
  hoods: Vec2;
  drops: Vec2;
  crankLength: number;
  cleatOffset: number;
  stemBase: Vec2;
  clamp: Vec2;
  headTop: Vec2;
  seatAxisTop: Vec2;
}

export type MetricId =
  | 'knee' | 'kneeTop' | 'hip' | 'torso' | 'shoulder' | 'elbow' | 'seatAngle' | 'handLoad' | 'kops';
export interface Band {
  min: number;
  max: number;
  weight: number;
  scale: number;
  center: number;
  unit: '°' | 'mm' | '%';
}
export type HandContact = 'hoods' | 'drops';
export interface PoseTarget {
  handContact: HandContact;
  elbowPref: number;
  bands: Partial<Record<MetricId, Band>>;
}
export type StyleId = 'endurance' | 'race' | 'gravel';
export interface Style {
  id: StyleId;
  name: string;
  blurb: string;
  cockpit: CockpitKind;
  defaultEffort: Effort;
  defaultHands: HandsPref;
  poses: PoseTarget[]; // [0] hoods, [1] drops
}

export interface FitContext {
  footStack: number;
  ankling: Ankling;
  wkg: number;
  frontAxle: Vec2 | null;
  wheelRadius: number;
}

export interface PoseEval {
  contact: HandContact;
  metrics: Record<MetricId, number>;
  overextended: boolean;
  /** How far short of the pedal the leg is at worst, mm; 0 when it always reaches. */
  legShortfall: number;
  overreach: boolean;
  pelvicTilt: number;
  comX: number;
}
export interface Evaluation {
  poses: PoseEval[];
  peakKneeCrank: number;
  toeClearance: number; // Infinity when there is no front wheel
}
