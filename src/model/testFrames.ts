import { DEFAULT_BODY } from './presets';
import type { Body, Frame } from './types';

/** The body the spike golden values were computed with (foot length 0.152·H). */
export const SPIKE_BODY: Body = { ...DEFAULT_BODY, shoeSizeAuto: false, overrides: { footLength: 0.152 * 1780 } };

/** Default rider with a fixed shoe size, so tests do not move when the suggestion changes. */
export const TEST_BODY: Body = { ...DEFAULT_BODY, shoeSize: 43, shoeSizeAuto: false };

export const SPIKE_FRAME: Frame = {
  id: 's', name: 's', stack: 565, reach: 385, seatTubeAngle: 73.5, headTubeAngle: 73,
  headTubeLength: 150, seatTubeLength: 530, chainstay: 410, wheelbase: 1000, bbDrop: 70, maxSpacers: 30,
  tyreWidth: 28,
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

/** Made-up frames the model tests and calibration checks are pinned to; not shown in the app. */
export const TEST_FRAMES: Frame[] = [
  fr('endurance-54', 'Test endurance 54', 575, 375, 73.5, 72, 165, 520, 415, 1000, 72, 40, 30),
  fr('endurance-56', 'Test endurance 56', 595, 383, 73.5, 72.5, 185, 540, 415, 1012, 72, 40, 30),
  fr('race-54', 'Test race 54', 545, 385, 73.5, 73, 140, 510, 408, 985, 70, 30, 28),
  fr('race-56', 'Test race 56', 565, 393, 73.5, 73.5, 160, 530, 408, 993, 70, 30, 28),
  fr('gravel-54', 'Test gravel 54', 580, 378, 73.5, 71, 155, 520, 425, 1035, 75, 40, 40),
  fr('gravel-56', 'Test gravel 56', 600, 388, 73.5, 71.5, 175, 540, 425, 1050, 75, 40, 40),
];
