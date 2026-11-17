import type { CatalogModel, CatalogSize } from '../data/catalog';
import { VERDICT_RANK, type CompareRow } from '../model/optimize';
import type { Frame } from '../model/types';

export interface SizeOption {
  size: string;
  frame: Frame;
}

/** The catalog model a saved catalog frame came from; the longest matching id wins. */
export function catalogModelFor(frameId: string, models: CatalogModel[]): CatalogModel | null {
  let best: CatalogModel | null = null;
  for (const m of models) {
    if (frameId.startsWith(`cat:${m.id}-`) && (!best || m.id.length > best.id.length)) best = m;
  }
  return best;
}

/** Every size of the frame's catalog model, with the saved frame standing in for its own size. */
export function sizeFamily(
  frame: Frame, models: CatalogModel[], toFrame: (m: CatalogModel, s: CatalogSize) => Frame,
): SizeOption[] | null {
  const m = catalogModelFor(frame.id, models);
  if (!m || m.sizes.length < 2) return null;
  const options = m.sizes.map((s) => {
    const f = toFrame(m, s);
    return { size: s.size, frame: f.id === frame.id ? frame : f };
  });
  return options.some((o) => o.frame.id === frame.id) ? options : null;
}

export function sizeVerdictLine(rows: CompareRow[], activeId: string, sizeOf: (id: string) => string): string {
  const best = rows[0];
  const cur = rows.find((r) => r.frameId === activeId) ?? best;
  if (best.frameId === activeId) return 'This size fits you best.';
  if (VERDICT_RANK[best.result.verdict] < VERDICT_RANK[cur.result.verdict]) return `Size ${sizeOf(best.frameId)} fits better.`;
  return `Size ${sizeOf(best.frameId)} is a closer fit.`;
}
