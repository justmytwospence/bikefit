import type { Vec2 } from '../../model/vec';
export const pts = (...p: Vec2[]) => p.map((q) => `${q.x},${q.y}`).join(' ');
