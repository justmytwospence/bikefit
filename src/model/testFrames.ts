import { DEFAULT_BODY } from './presets';
import type { Body, Frame } from './types';

/** The body the spike golden values were computed with (foot length 0.152·H). */
export const SPIKE_BODY: Body = { ...DEFAULT_BODY, overrides: { footLength: 0.152 * 1780 } };

export const SPIKE_FRAME: Frame = {
  id: 's', name: 's', stack: 565, reach: 385, seatTubeAngle: 73.5, headTubeAngle: 73,
  headTubeLength: 150, seatTubeLength: 530, chainstay: 410, wheelbase: 1000, bbDrop: 70, maxSpacers: 30,
  tyreWidth: 28,
};
