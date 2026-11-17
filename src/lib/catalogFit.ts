import type { CatalogModel, CatalogSize } from '../data/catalog';
import { forwardLayout } from '../model/geometry';
import { DEFAULT_PARAMS } from '../model/presets';
import type { Components, Frame } from '../model/types';
import type { Vec2 } from '../model/vec';

export interface Candidate {
  frame: Frame;
  modelId: string;
  size: string;
}

/**
 * The sizes worth optimizing: per model, the `perModel` sizes whose hoods (default stem and angle, up to 20 mm
 * of spacers) land nearest the ideal hoods point. Returned in catalog order.
 */
export function screenCatalog(
  models: CatalogModel[], toFrame: (m: CatalogModel, s: CatalogSize) => Frame,
  components: Components, idealHoods: Vec2, perModel = 2,
): Candidate[] {
  const out: Candidate[] = [];
  for (const m of models) {
    const frames = m.sizes.map((s) => toFrame(m, s));
    const dist = frames.map((f) => {
      const h = forwardLayout(f, components, { ...DEFAULT_PARAMS, spacers: Math.min(DEFAULT_PARAMS.spacers, f.maxSpacers) }).hoods;
      return Math.hypot(h.x - idealHoods.x, h.y - idealHoods.y);
    });
    const keep = dist
      .map((d, i) => ({ d, i }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, perModel)
      .map((x) => x.i)
      .sort((a, b) => a - b);
    for (const i of keep) out.push({ frame: frames[i], modelId: m.id, size: m.sizes[i].size });
  }
  return out;
}
