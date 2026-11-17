import type { CatalogModel, CatalogSize } from '../data/catalog';
import { forwardLayout } from '../model/geometry';
import { DEFAULT_PARAMS } from '../model/presets';
import type { Components, Frame, PartOptions } from '../model/types';
import type { Vec2 } from '../model/vec';

export interface ModelJob {
  modelId: string;
  frames: Frame[];
  start: number;
  dist: number;
}

/**
 * Every model with all its sizes, the index of the size whose hoods (default stem and angle, up to 20 mm of
 * spacers) land nearest the ideal hoods point, and that distance. Sorted nearest first, then by model order.
 */
export function screenCatalog(
  models: CatalogModel[], toFrame: (m: CatalogModel, s: CatalogSize) => Frame,
  components: Components, idealHoods: Vec2,
): ModelJob[] {
  const jobs = models.map((m, order) => {
    const frames = m.sizes.map((s) => toFrame(m, s));
    let start = 0;
    let dist = Infinity;
    frames.forEach((f, i) => {
      const h = forwardLayout(f, components, { ...DEFAULT_PARAMS, spacers: Math.min(DEFAULT_PARAMS.spacers, f.maxSpacers) }).hoods;
      const d = Math.hypot(h.x - idealHoods.x, h.y - idealHoods.y);
      if (d < dist) {
        dist = d;
        start = i;
      }
    });
    return { job: { modelId: m.id, frames, start, dist }, order };
  });
  return jobs.sort((a, b) => a.job.dist - b.job.dist || a.order - b.order).map((x) => x.job);
}

/** How many stem length/angle pairs a catalog check keeps per frame. */
export const NEAR_STEMS = 10;

/**
 * The stem lengths and angles of the `k` pairs whose hoods, over the frame's spacer range, come nearest the
 * ideal hoods point. Lists keep the order of `options`.
 */
export function nearStems(
  frame: Frame, components: Components, options: PartOptions, idealHoods: Vec2, k = NEAR_STEMS,
): Pick<PartOptions, 'stemLengths' | 'stemAngles'> {
  const pairs: { s: number; a: number; d: number }[] = [];
  for (const s of options.stemLengths) {
    for (const a of options.stemAngles) {
      let d = Infinity;
      for (let spacers = 0; spacers <= frame.maxSpacers; spacers += options.spacerStep) {
        const h = forwardLayout(frame, components, { ...DEFAULT_PARAMS, stemLength: s, stemAngle: a, spacers }).hoods;
        d = Math.min(d, Math.hypot(h.x - idealHoods.x, h.y - idealHoods.y));
      }
      pairs.push({ s, a, d });
    }
  }
  const taken = pairs.map((p, i) => ({ p, i })).sort((x, y) => x.p.d - y.p.d || x.i - y.i).slice(0, k).map((x) => x.p);
  return {
    stemLengths: options.stemLengths.filter((s) => taken.some((p) => p.s === s)),
    stemAngles: options.stemAngles.filter((a) => taken.some((p) => p.a === a)),
  };
}
