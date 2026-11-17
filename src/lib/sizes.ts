import type { CatalogModel, CatalogSize } from '../data/catalog';
import { byVerdictThenCost, VERDICT_RANK, type CompareRow } from '../model/optimize';
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

export interface ModelGroup {
  key: string;
  name: string;
  sizes: { size: string; row: CompareRow }[];
  best: CompareRow;
}

/** Compare rows with the sizes of one catalog model merged; groups keep the order of their best row. */
export function groupRows(rows: CompareRow[], frames: Frame[]): ModelGroup[] {
  const order = new Map(frames.map((f, i) => [f.id, i]));
  const groups: ModelGroup[] = [];
  for (const row of rows) {
    const cut = row.frameName.lastIndexOf(' · ');
    const model = row.frameId.startsWith('cat:') && cut >= 0;
    const key = model ? 'm:' + row.frameName.slice(0, cut) : 'f:' + row.frameId;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, name: model ? row.frameName.slice(0, cut) : row.frameName, sizes: [], best: row }));
    g.sizes.push({ size: model ? row.frameName.slice(cut + 3) : '', row });
    if (byVerdictThenCost(row, g.best) < 0) g.best = row;
  }
  for (const g of groups) g.sizes.sort((a, b) => (order.get(a.row.frameId) ?? 0) - (order.get(b.row.frameId) ?? 0));
  return groups;
}
