import type { CatalogModel, CatalogSize } from '../data/catalog';
import { byVerdictThenCost, type CompareRow } from '../model/optimize';
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

/** A neighbouring size this many points or fewer behind the best one makes the rider between sizes. */
export const TIE_POINTS = 3;

/** A size more than this many points behind the best one is not worth considering. */
export const FAR_POINTS = 20;

/**
 * How a size stands among the sizes of its model: the best one (`pick`), a neighbour too close to call
 * (`alt`), one that can be made to work (`ok`), one that is too far off to consider (`far`), or one that
 * does not fit at all (`no`).
 */
export type Standing = 'pick' | 'alt' | 'ok' | 'far' | 'no';

export interface SizeEntry {
  size: string;
  row: CompareRow;
  frame: Frame;
  standing: Standing;
}

/**
 * Marks the best size and, when a size next to it scores within TIE_POINTS, that one as the alternative.
 * `entries` are in size order; returns them with `standing` set.
 */
export function rankSizes(entries: Omit<SizeEntry, 'standing'>[]): SizeEntry[] {
  const fits = entries.filter((e) => e.row.result.verdict !== 'no');
  const pick = fits.length ? fits.reduce((a, b) => (byVerdictThenCost(b.row, a.row) < 0 ? b : a)) : null;
  const pi = pick ? entries.indexOf(pick) : -1;
  const alt = pick
    ? [entries[pi - 1], entries[pi + 1]]
        .filter((e) => e && e.row.result.verdict !== 'no' && pick.row.result.score - e.row.result.score <= TIE_POINTS)
        .sort((a, b) => byVerdictThenCost(a.row, b.row))[0] ?? null
    : null;
  return entries.map((e) => ({
    ...e,
    standing: e === pick ? 'pick' : e === alt ? 'alt' : e.row.result.verdict === 'no' ? 'no'
      : pick!.row.result.score - e.row.result.score > FAR_POINTS ? 'far' : 'ok',
  }));
}

/** The sizes of one model from an Optimize on Fit my bike, in size order with their standing. */
export function sizeEntries(rows: CompareRow[], options: SizeOption[]): SizeEntry[] {
  return rankSizes(
    options.flatMap((o) => {
      const row = rows.find((r) => r.frameId === o.frame.id);
      return row ? [{ size: o.size, row, frame: o.frame }] : [];
    }),
  );
}

/** The best size and its too-close-to-call neighbour in size order, or null when one size clearly wins. */
export function betweenSizes(entries: SizeEntry[]): [SizeEntry, SizeEntry] | null {
  const pair = entries.filter((e) => e.standing === 'pick' || e.standing === 'alt');
  return pair.length === 2 ? [pair[0], pair[1]] : null;
}

/** One line on where the size being looked at stands. */
export function sizeAdviceLine(entries: SizeEntry[], activeId: string): string {
  const pick = entries.find((e) => e.standing === 'pick');
  if (!pick) return 'No size of this bike fits you.';
  const pair = betweenSizes(entries);
  const active = entries.find((e) => e.frame.id === activeId);
  const mine = active && (active.standing === 'pick' || active.standing === 'alt');
  if (pair) {
    return mine
      ? `You are between sizes ${pair[0].size} and ${pair[1].size}.`
      : `Sizes ${pair[0].size} and ${pair[1].size} fit better; you are between them.`;
  }
  return mine ? 'This size fits you best.' : `Size ${pick.size} fits better.`;
}

export interface ModelGroup {
  key: string;
  name: string;
  /** In size order. */
  sizes: SizeEntry[];
  best: CompareRow;
}

/** Compare rows with the sizes of one catalog model merged; groups keep the order of their best row. */
export function groupRows(rows: CompareRow[], frames: Frame[]): ModelGroup[] {
  const order = new Map(frames.map((f, i) => [f.id, i]));
  const raw: { key: string; name: string; sizes: Omit<SizeEntry, 'standing'>[] }[] = [];
  const byKey = new Map<string, (typeof raw)[number]>();
  for (const row of rows) {
    const cut = row.frameName.lastIndexOf(' · ');
    const model = row.frameId.startsWith('cat:') && cut >= 0;
    const key = model ? 'm:' + row.frameName.slice(0, cut) : 'f:' + row.frameId;
    let g = byKey.get(key);
    if (!g) {
      g = { key, name: model ? row.frameName.slice(0, cut) : row.frameName, sizes: [] };
      raw.push(g);
      byKey.set(key, g);
    }
    const i = order.get(row.frameId);
    g.sizes.push({ size: model ? row.frameName.slice(cut + 3) : '', row, frame: frames[i ?? -1] });
  }
  return raw.map((g) => {
    const sizes = rankSizes(g.sizes.sort((a, b) => (order.get(a.row.frameId) ?? 0) - (order.get(b.row.frameId) ?? 0)));
    const best = (sizes.find((s) => s.standing === 'pick') ?? sizes.reduce((a, b) => (byVerdictThenCost(b.row, a.row) < 0 ? b : a))).row;
    return { key: g.key, name: g.name, sizes, best };
  });
}
