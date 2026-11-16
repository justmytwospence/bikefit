/** Display units for body measurements. Bike geometry and fit settings are always in mm. */
export type Units = 'metric' | 'imperial';

export const MM_PER_IN = 25.4;

export const roundTo = (x: number, step: number): number => Math.round(x / step) * step;

/** Height in whole feet plus inches (to the nearest half inch). */
export function feetInches(mm: number): { ft: number; inch: number } {
  const total = roundTo(mm / MM_PER_IN, 0.5);
  const ft = Math.floor(total / 12);
  return { ft, inch: total - ft * 12 };
}

export const fromFeetInches = (ft: number, inch: number): number => (ft * 12 + inch) * MM_PER_IN;

export interface LengthField {
  unit: string;
  /** mm per display unit */
  factor: number;
  step: number;
  min: number;
  max: number;
}

/** A body length shown in cm (or mm for segments) in metric, inches in imperial. Bounds are in mm. */
export function lengthField(units: Units, metricUnit: 'cm' | 'mm', minMm: number, maxMm: number): LengthField {
  if (units === 'imperial') {
    const step = metricUnit === 'mm' ? 0.1 : 0.25;
    return {
      unit: 'in', factor: MM_PER_IN, step,
      min: roundTo(minMm / MM_PER_IN, step), max: roundTo(maxMm / MM_PER_IN, step),
    };
  }
  const factor = metricUnit === 'cm' ? 10 : 1;
  return { unit: metricUnit, factor, step: metricUnit === 'cm' ? 0.5 : 5, min: minMm / factor, max: maxMm / factor };
}

/** mm to the field's display value, rounded to its step. */
export const toDisplay = (mm: number, f: LengthField): number =>
  Math.round(roundTo(mm / f.factor, f.step) * 1000) / 1000;
export const fromDisplay = (v: number, f: LengthField): number => v * f.factor;
