import type { Body, Components, FitParams, Frame, PartOptions } from './types';

export const DEFAULT_BODY: Body = {
  height: 1780, inseam: 840, flexibility: 'medium', shoeSize: 43, armLength: null, ankling: 'neutral', overrides: {},
};

export const DEFAULT_COMPONENTS: Components = {
  cockpit: 'dropbar',
  barReach: 80,
  barDrop: 125,
  hoodReach: 25,
  hoodRise: 30,
  headsetCap: 10,
  footStack: 20,
  saddleLength: 270,
};

export const DEFAULT_OPTIONS: PartOptions = {
  stemLengths: [60, 70, 80, 90, 100, 110, 120, 130, 140],
  stemAngles: [-17, -10, -6, 0, 6, 10, 17],
  crankLengths: [160, 165, 170, 172.5, 175],
  seatpostSetbacks: [0, 15, 25],
  saddleHeightRange: [550, 900],
  railRange: [-20, 20],
  cleatRange: [0, 20],
  spacerStep: 5,
};

export const DEFAULT_PARAMS: FitParams = {
  saddleHeight: 735,
  railOffset: 0,
  seatpostSetback: 15,
  spacers: 20,
  stemLength: 100,
  stemAngle: -6,
  crankLength: 172.5,
  cleatOffset: 5,
};

function fr(
  id: string, name: string, stack: number, reach: number, sta: number, hta: number,
  ht: number, st: number, cs: number, wb: number, drop: number, maxSpacers: number, tyreWidth: number,
): Frame {
  return {
    id, name, stack, reach, seatTubeAngle: sta, headTubeAngle: hta, headTubeLength: ht,
    seatTubeLength: st, chainstay: cs, wheelbase: wb, bbDrop: drop, maxSpacers, tyreWidth,
  };
}

export const EXAMPLE_FRAMES: Frame[] = [
  fr('endurance-54', 'Example endurance 54', 575, 375, 73.5, 72, 165, 520, 415, 1000, 72, 40, 30),
  fr('endurance-56', 'Example endurance 56', 595, 383, 73.5, 72.5, 185, 540, 415, 1012, 72, 40, 30),
  fr('race-54', 'Example race 54', 545, 385, 73.5, 73, 140, 510, 408, 985, 70, 30, 28),
  fr('race-56', 'Example race 56', 565, 393, 73.5, 73.5, 160, 530, 408, 993, 70, 30, 28),
  fr('gravel-54', 'Example gravel 54', 580, 378, 73.5, 71, 155, 520, 425, 1035, 75, 40, 40),
  fr('gravel-56', 'Example gravel 56', 600, 388, 73.5, 71.5, 175, 540, 425, 1050, 75, 40, 40),
];
