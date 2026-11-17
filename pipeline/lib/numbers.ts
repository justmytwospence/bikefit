import { RANGES, type GeometryKey } from '../../src/data/schema';

const ANGLES: GeometryKey[] = ['seatTubeAngle', 'headTubeAngle'];

/** The first number in a cell, in mm (lengths) or degrees (angles), or null. `unitHint` is the row label's raw text. */
export function parseValue(key: GeometryKey, text: string, unitHint = ''): number | null {
  const m = text.replace(/\u00a0/g, ' ').match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  let raw = m[0];
  if (/^-?\d,\d{3}$/.test(raw)) raw = raw.replace(',', '');
  let v = Number(raw.replace(',', '.'));
  if (!Number.isFinite(v)) return null;
  if (ANGLES.includes(key)) return Math.round(v * 10) / 10;
  if (key === 'bbDrop') v = Math.abs(v);
  const after = text.slice((m.index ?? 0) + m[0].length);
  if (/^\s*(in\b|inch|["”″])/i.test(after) || /\((in|inch|inches)\)/i.test(unitHint)) return Math.round(v * 25.4);
  // Centimetres and metres show up as too-small numbers: take the scale that lands in the plausible range.
  const [lo, hi] = RANGES[key];
  for (const scale of [1, 10, 1000]) if (v * scale >= lo && v * scale <= hi) return Math.round(v * scale);
  return Math.round(v);
}
