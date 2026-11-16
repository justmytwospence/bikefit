import { frameSkeleton } from './geometry';
import type { Ankling, Components, Effort, FitContext, Frame, HandsPref } from './types';

export const EFFORT_WKG: Record<Effort, number> = { easy: 1.5, tempo: 2.5, hard: 3.5 };
export const EFFORT_LABELS: Record<Effort, { label: string; hint: string }> = {
  easy: { label: 'Chatty', hint: 'You could hold a conversation' },
  tempo: { label: 'Tempo', hint: 'Short sentences only' },
  hard: { label: 'Race hard', hint: "Can't talk" },
};
export const HANDS_LABELS: Record<HandsPref, string> = {
  hoods: 'Mostly hoods',
  mixed: 'Mixed',
  drops: 'Mostly drops',
};
export const ANKLING: Record<Ankling, { mean: number; amp: number; label: string; hint: string }> = {
  heelDrop: { mean: 13, amp: 8, label: 'Heel drops', hint: 'Your heel dips below the pedal at the bottom of the stroke' },
  neutral: { mean: 18, amp: 9, label: 'Neutral', hint: 'Foot stays about level' },
  toePoint: { mean: 23, amp: 9, label: 'Toes point', hint: 'Toes point down through the bottom of the stroke' },
};

export function soleAngle(ankling: Ankling, phiDeg: number): number {
  const a = ANKLING[ankling];
  return a.mean + a.amp * Math.cos(((phiDeg - 160) * Math.PI) / 180);
}

export function poseWeights(h: HandsPref): number[] {
  return h === 'hoods' ? [1, 0.3] : h === 'mixed' ? [1, 0.6] : [0.6, 1];
}

export function makeContext(
  frame: Frame | null, comp: Components, ankling: Ankling, effort: Effort,
): FitContext {
  return {
    footStack: comp.footStack,
    ankling,
    wkg: EFFORT_WKG[effort],
    frontAxle: frame ? frameSkeleton(frame).frontAxle : null,
    wheelRadius: frame ? 311 + frame.tyreWidth : 0,
  };
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
export function shoeLabel(eu: number, units: 'metric' | 'imperial' = 'metric'): string {
  return units === 'imperial'
    ? `US M ${trim(eu - 33.5)} · EU ${trim(eu)}`
    : `EU ${trim(eu)} · US M ${trim(eu - 33.5)}`;
}
