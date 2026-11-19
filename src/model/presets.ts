import type { Body, Components, FitParams, Frame, PartOptions } from './types';

export const DEFAULT_BODY: Body = {
  height: 1780, inseam: 840, flexibility: 'medium', shoeSize: 43, shoeSizeAuto: true, sex: 'male', armLength: null, ankling: 'neutral', overrides: {},
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

/**
 * The frame a new visitor starts on: a Trek Domane Gen 4 in 56, copied from the catalog
 * (src/data/frames/trek.json) so the main bundle does not load the whole catalog.
 * src/data/catalog.test.ts checks it still matches.
 */
export const DEFAULT_FRAME: Frame = {
  id: 'cat:trek-domane-gen-4-2023-56', name: 'Trek Domane Gen 4 2023–2025 · 56',
  stack: 591, reach: 377, seatTubeAngle: 73.3, headTubeAngle: 71.9, headTubeLength: 175,
  seatTubeLength: 525, chainstay: 420, wheelbase: 1008, bbDrop: 78, maxSpacers: 40, tyreWidth: 32,
};
