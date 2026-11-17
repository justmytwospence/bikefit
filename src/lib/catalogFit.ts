import type { CatalogModel, CatalogSize } from '../data/catalog';
import { forwardLayout } from '../model/geometry';
import { DEFAULT_PARAMS } from '../model/presets';
import type { Components, Frame } from '../model/types';
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
