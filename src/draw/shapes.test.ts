import { describe, expect, it } from 'vitest';
import { resolveSegments } from '../model/body';
import { DEFAULT_BODY } from '../model/presets';
import {
  capsulePoints, dimension, footFrame, placeLabel, riderRadii, shoeLocal, smoothClosedPath, SOLE_T, toWorld,
} from './shapes';

describe('capsulePoints', () => {
  it('wraps both circles', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    const pts = capsulePoints(a, b, 20, 10);
    expect(pts).toHaveLength(22);
    expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(110, 0);
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(-20, 0);
    expect(Math.max(...pts.map((p) => Math.abs(p.y)))).toBeLessThanOrEqual(20.01);
    for (const p of pts) {
      const da = Math.abs(Math.hypot(p.x - a.x, p.y - a.y) - 20);
      const db = Math.abs(Math.hypot(p.x - b.x, p.y - b.y) - 10);
      expect(Math.min(da, db)).toBeLessThan(0.01);
    }
  });
  it('degenerates to a circle', () => {
    const pts = capsulePoints({ x: 5, y: 5 }, { x: 5, y: 5 }, 20, 10);
    expect(pts).toHaveLength(20);
    for (const p of pts) expect(Math.hypot(p.x - 5, p.y - 5)).toBeCloseTo(20, 6);
  });
});

describe('smoothClosedPath', () => {
  it('has one curve per point', () => {
    const d = smoothClosedPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    expect(d.startsWith('M')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(4);
    expect(d.endsWith('Z')).toBe(true);
  });
});

describe('foot frame', () => {
  it('maps local to world', () => {
    const ball = { x: 100, y: 50 };
    const w = toWorld(footFrame(ball, 0), { x: 10, y: 5 });
    expect([w.x, w.y]).toEqual([110, 55]);
    const fr = footFrame(ball, 90);
    expect(fr.u.x).toBeCloseTo(0, 9);
    expect(fr.u.y).toBeCloseTo(-1, 9);
  });
});

describe('shoeLocal', () => {
  const seg = resolveSegments(DEFAULT_BODY);
  it('puts the spindle behind the ball by the cleat offset', () => {
    const s = shoeLocal(seg, 20, 5);
    expect(s.spindle).toEqual({ x: -5, y: -20 });
    const xs = s.cleat.map((p) => p.x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(-5, 9);
    expect(Math.min(...s.outline.map((p) => p.x))).toBe(s.heel);
    expect(Math.max(...s.outline.map((p) => p.x))).toBe(seg.toeAhead);
    expect(Math.min(...s.cleat.map((p) => p.y))).toBeLessThan(-SOLE_T);
  });
  it('keeps the cleat below the sole at low stack', () => {
    expect(Math.min(...shoeLocal(seg, 5, 5).cleat.map((p) => p.y))).toBeLessThanOrEqual(-SOLE_T - 3);
  });
});

describe('placeLabel', () => {
  it('returns the first point when nothing is in the way', () => {
    const p = placeLabel({ x: 0, y: 0 }, 0, 50, []);
    expect(p.x).toBeCloseTo(50, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });
  it('steps past an obstacle', () => {
    const p = placeLabel({ x: 0, y: 0 }, 0, 50, [{ a: { x: 40, y: -100 }, b: { x: 40, y: 100 }, r: 20 }]);
    expect(p.x).toBeGreaterThan(50);
    expect(p.x - 40).toBeGreaterThan(20 + 34);
  });
});

describe('dimension and radii', () => {
  it('offsets to the left', () => {
    const d = dimension({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
    expect(d.a).toEqual({ x: 0, y: 20 });
    expect(d.b).toEqual({ x: 100, y: 20 });
    expect(d.mid).toEqual({ x: 50, y: 50 });
  });
  it('scales radii with height', () => expect(riderRadii(1780).head).toBeCloseTo(89, 9));
});
