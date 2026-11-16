export interface Vec2 {
  x: number;
  y: number;
}

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const unit = (a: Vec2): Vec2 => {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
export const rad = (d: number): number => (d * Math.PI) / 180;
export const deg = (r: number): number => (r * 180) / Math.PI;
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Rotate counterclockwise by degrees. */
export function rotate(a: Vec2, degrees: number): Vec2 {
  const t = rad(degrees);
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** Unsigned angle between two vectors, degrees. */
export function angleBetween(a: Vec2, b: Vec2): number {
  const d = len(a) * len(b);
  if (d === 0) return 0;
  return deg(Math.acos(clamp((a.x * b.x + a.y * b.y) / d, -1, 1)));
}

/** Angle (degrees) opposite side c in a triangle with sides a, b, c. */
export function lawOfCosAngle(a: number, b: number, c: number): number {
  if (a === 0 || b === 0) return 0;
  return deg(Math.acos(clamp((a * a + b * b - c * c) / (2 * a * b), -1, 1)));
}
