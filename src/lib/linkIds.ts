import type { MetricId } from '../model/types';

/** Fit settings, by the part of the drawing they move. */
export type SettingLink = 'saddleHeight' | 'setback' | 'cleat' | 'spacers' | 'stem' | 'crank';
export type FrameLink = 'stack' | 'reach' | 'seatTubeAngle' | 'headTubeAngle' | 'headTubeLength' | 'seatTubeLength'
  | 'chainstay' | 'wheelbase' | 'bbDrop' | 'maxSpacers' | 'tyreWidth';
export type PartLink = 'barReach' | 'barDrop' | 'saddleLength' | 'footStack' | 'headsetCap' | 'hoodReach' | 'hoodRise';
export type BodyLink = 'height' | 'inseam' | 'arm' | 'femur' | 'tibia' | 'torso' | 'upperArm' | 'forearmGrip' | 'footLength' | 'shoe';

/** Everything in the panel that has a counterpart on the drawing. */
export type LinkId = SettingLink | `m:${MetricId}` | `f:${FrameLink}` | `c:${PartLink}` | `b:${BodyLink}`
  | 'r:reach' | 'r:drop' | 'r:toe' | 'r:hoods' | 'r:seatpost';
