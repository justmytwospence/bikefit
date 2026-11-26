import { DEFAULT_BODY, DEFAULT_COMPONENTS, DEFAULT_FRAME, DEFAULT_OPTIONS, DEFAULT_PARAMS } from '../model/presets';
import { KNOB_ORDER, presetLocks } from './knobs';
import { validReport, type FitReport } from '../model/fitReport';
import type { Units } from './units';
import type {
  Body, Components, Effort, FitParams, Frame, HandsPref, ParamKey, PartOptions, StyleId,
} from '../model/types';

export type Tab = 'rider' | 'mybike' | 'find';

const OLD_TABS: Record<string, Tab> = { bike: 'mybike', fit: 'mybike', compare: 'find' };
/** Saved data and links from before the tabs were merged name the old ones. */
export function migrateTab(t: unknown): Tab {
  if (t === 'rider' || t === 'mybike' || t === 'find') return t;
  return (typeof t === 'string' && OLD_TABS[t]) || 'rider';
}
export type Level = 1 | 2 | 3;

export const LEVEL_OPTIONS = [
  { value: '1', label: 'Simple' },
  { value: '2', label: 'Detailed' },
  { value: '3', label: 'Expert' },
];

const clampLv = (x: unknown) => Math.min(3, Math.max(1, Math.round(Number(x)) || 1)) as Level;

export interface RiderOpen {
  ride: boolean;
  arms: boolean;
  segments: boolean;
  report: boolean;
}

/** Older data kept a Rider level instead of open sections: Detailed opened the first two, Expert all three. */
const openFromLevel = (lv: Level): RiderOpen => ({ ride: lv >= 2, arms: lv >= 2, segments: lv >= 3, report: false });

export interface AppData {
  v: 3;
  body: Body;
  styleId: StyleId;
  frames: Frame[];
  activeFrameId: string;
  components: Components;
  options: PartOptions;
  /** The target: what Fit my bike suggests or you set, edited under Target. */
  current: FitParams;
  /** Your current setup: the bike as you ride it, edited under Current setup. */
  baseline: FitParams;
  /** Settings the rider said to leave as they are; no target changes them. */
  pins: Record<ParamKey, boolean>;
  tab: Tab;
  effort: Effort | null;
  hands: HandsPref | null;
  detail: { bikeFull: boolean; results: Level };
  /** Which optional Rider sections are open. */
  riderOpen: RiderOpen;
  /** Numbers typed in from a professional fit report, or null. */
  report: FitReport | null;
  units: Units;
  /** Whether the first-run guide on the Rider tab has been dismissed. */
  seenIntro: boolean;
}

export function defaults(): AppData {
  return structuredClone({
    v: 3 as const,
    body: DEFAULT_BODY,
    styleId: 'endurance' as StyleId,
    frames: [DEFAULT_FRAME],
    activeFrameId: DEFAULT_FRAME.id,
    components: DEFAULT_COMPONENTS,
    options: DEFAULT_OPTIONS,
    current: DEFAULT_PARAMS,
    baseline: { ...DEFAULT_PARAMS },
    pins: presetLocks('all'),
    tab: 'rider' as Tab,
    effort: null,
    hands: null,
    detail: { bikeFull: false, results: 1 as Level },
    riderOpen: openFromLevel(1),
    report: null,
    units: 'metric' as Units,
    seenIntro: false,
  });
}

/** Accepts v1, v2 or v3 saved data and fills anything missing from the defaults. */
export function migrate(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, any>;
  if ((d.v !== 1 && d.v !== 2 && d.v !== 3) || !Array.isArray(d.frames) || d.frames.length === 0) return null;
  const base = defaults();
  const frames = (d.frames as Frame[]).filter((f) => !isOldExample(f)).map(moved)
    .filter((f, i, all) => all.findIndex((x) => x.id === f.id) === i);
  if (!frames.length) frames.push(...base.frames);
  const wanted = typeof d.activeFrameId === 'string' ? movedId(d.activeFrameId) : '';
  const activeFrameId = frames.some((f) => f.id === wanted) ? wanted : frames[0].id;
  let detail: AppData['detail'];
  let riderLevel: Level;
  if (d.detail && typeof d.detail === 'object' && 'results' in d.detail) {
    detail = { bikeFull: d.detail.bikeFull === true, results: clampLv(d.detail.results) };
    riderLevel = clampLv(d.detail.rider);
  } else {
    const g = clampLv(Math.max(1, d.detail?.global ?? 1, ...Object.values(d.detail?.overrides ?? {}).map(Number)));
    detail = { bikeFull: g >= 2, results: g };
    riderLevel = g;
  }
  const { hasSetup, scope: _s, locks: _l, ...rest } = d;
  const pins = Object.fromEntries(KNOB_ORDER.map((k) => [k, d.pins?.[k] === true])) as Record<ParamKey, boolean>;
  let baseline = { ...base.baseline, ...d.baseline };
  const current = { ...base.current, ...d.current };
  if (d.v !== 3) {
    // Older data: a New build becomes the bike you ride.
    const rode = typeof hasSetup === 'boolean'
      ? hasSetup
      : (Object.keys(base.baseline) as ParamKey[]).some((k) => d.baseline?.[k] !== undefined && d.baseline[k] !== base.baseline[k]);
    if (!rode) baseline = { ...current };
  }
  const o = d.riderOpen;
  const riderOpen: RiderOpen = o && typeof o === 'object'
    ? { ride: o.ride === true, arms: o.arms === true, segments: o.segments === true, report: o.report === true }
    : openFromLevel(riderLevel);
  const report = validReport(d.report);
  const styleId: StyleId = d.styleId === 'fitted' ? (report ? 'fitted' : 'endurance')
    : ['endurance', 'sport', 'race', 'gravel'].includes(d.styleId) ? d.styleId : 'endurance';
  return {
    ...base,
    ...rest,
    v: 3,
    body: {
      ...base.body,
      ...d.body,
      sex: d.body?.sex === 'female' ? 'female' : 'male',
      shoeSizeAuto: d.body?.shoeSizeAuto ?? d.body?.shoeSize == null,
      shoeSize: d.body?.shoeSize ?? base.body.shoeSize,
    },
    components: { ...base.components, ...d.components },
    options: base.options,
    current,
    baseline,
    pins,
    detail,
    riderOpen,
    report,
    styleId,
    frames: frames.map((f) => ({ ...f, tyreWidth: f.tyreWidth ?? 30 })),
    activeFrameId,
    tab: migrateTab(d.tab),
    effort: d.effort ?? null,
    hands: d.hands ?? null,
    units: d.units === 'imperial' ? 'imperial' : 'metric',
    seenIntro: d.seenIntro ?? true,
  } as AppData;
}

/**
 * Catalog models whose id changed when the catalog's model years were corrected, as old id prefix, new id
 * prefix, and the years in the old and new names. Saved sizes of them follow, so they keep their size family.
 */
const MOVED: [string, string, string, string][] = [
  ['cat:trek-domane-gen-4-2020-', 'cat:trek-domane-gen-4-2023-', ' 2020–2026 · ', ' 2023–2025 · '],
];
function movedId(id: string): string {
  const hit = MOVED.find(([from]) => id.startsWith(from));
  return hit ? hit[1] + id.slice(hit[0].length) : id;
}
const moved = (f: Frame): Frame => {
  const hit = MOVED.find(([from]) => f.id.startsWith(from));
  return hit ? { ...f, id: movedId(f.id), name: f.name.replace(hit[2], hit[3]) } : f;
};

/** The made-up frames older versions saved for every visitor; dropped now that the catalog has real ones. */
const OLD_EXAMPLE_IDS = new Set(['endurance-54', 'endurance-56', 'race-54', 'race-56', 'gravel-54', 'gravel-56']);
const isOldExample = (f: Frame) => OLD_EXAMPLE_IDS.has(f.id) && f.name.startsWith('Example ');
