import { DEFAULT_BODY, DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS, EXAMPLE_FRAMES } from '../model/presets';
import { presetLocks } from './knobs';
import type { Units } from './units';
import type {
  Body, Components, Effort, FitParams, Frame, HandsPref, ParamKey, PartOptions, StyleId,
} from '../model/types';

export type Tab = 'rider' | 'bike' | 'fit' | 'compare';
export type Level = 1 | 2 | 3;

export const LEVEL_OPTIONS = [
  { value: '1', label: 'Simple' },
  { value: '2', label: 'Detailed' },
  { value: '3', label: 'Expert' },
];

const clampLv = (x: unknown) => Math.min(3, Math.max(1, Math.round(Number(x)) || 1)) as Level;

export interface AppData {
  v: 2;
  body: Body;
  styleId: StyleId;
  frames: Frame[];
  activeFrameId: string;
  components: Components;
  options: PartOptions;
  current: FitParams;
  baseline: FitParams;
  locks: Record<ParamKey, boolean>;
  tab: Tab;
  effort: Effort | null;
  hands: HandsPref | null;
  detail: { rider: Level; bikeFull: boolean; results: Level };
  units: Units;
  /** False until the user says they have a bike set up; until then Optimize suggests a build from scratch. */
  hasSetup: boolean;
  /** Whether the first-run guide on the Rider tab has been dismissed. */
  seenIntro: boolean;
}

export function defaults(): AppData {
  return structuredClone({
    v: 2 as const,
    body: DEFAULT_BODY,
    styleId: 'endurance' as StyleId,
    frames: EXAMPLE_FRAMES,
    activeFrameId: 'endurance-56',
    components: DEFAULT_COMPONENTS,
    options: DEFAULT_OPTIONS,
    current: DEFAULT_PARAMS,
    baseline: DEFAULT_PARAMS,
    locks: presetLocks('parts'),
    tab: 'rider' as Tab,
    effort: null,
    hands: null,
    detail: { rider: 1 as Level, bikeFull: false, results: 1 as Level },
    units: 'metric' as Units,
    hasSetup: false,
    seenIntro: false,
  });
}

/** Accepts v1 or v2 saved data and fills anything missing from the defaults. */
export function migrate(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, any>;
  if ((d.v !== 1 && d.v !== 2) || !Array.isArray(d.frames) || d.frames.length === 0) return null;
  const base = defaults();
  let detail: AppData['detail'];
  let locks: Record<ParamKey, boolean>;
  if (d.detail && typeof d.detail === 'object' && 'rider' in d.detail) {
    detail = { rider: clampLv(d.detail.rider), bikeFull: d.detail.bikeFull === true, results: clampLv(d.detail.results) };
    locks = { ...base.locks, ...d.locks };
  } else {
    const g = clampLv(Math.max(1, d.detail?.global ?? 1, ...Object.values(d.detail?.overrides ?? {}).map(Number)));
    detail = { rider: g, bikeFull: g >= 2, results: g };
    locks = g === 1 ? presetLocks('parts') : { ...base.locks, ...d.locks };
  }
  return {
    ...base,
    ...d,
    v: 2,
    body: {
      ...base.body,
      ...d.body,
      sex: d.body?.sex === 'female' ? 'female' : 'male',
      shoeSizeAuto: d.body?.shoeSizeAuto ?? d.body?.shoeSize == null,
      shoeSize: d.body?.shoeSize ?? base.body.shoeSize,
    },
    components: { ...base.components, ...d.components },
    options: { ...base.options, ...d.options },
    current: { ...base.current, ...d.current },
    baseline: { ...base.baseline, ...d.baseline },
    locks,
    detail,
    frames: d.frames.map((f: Frame) => ({ ...f, tyreWidth: f.tyreWidth ?? 30 })),
    effort: d.effort ?? null,
    hands: d.hands ?? null,
    units: d.units === 'imperial' ? 'imperial' : 'metric',
    seenIntro: d.seenIntro ?? true,
    hasSetup: typeof d.hasSetup === 'boolean'
      ? d.hasSetup
      : (Object.keys(base.baseline) as ParamKey[]).some(
        (k) => d.baseline?.[k] !== undefined && d.baseline[k] !== base.baseline[k],
      ),
  } as AppData;
}

export function hiddenRiderValues(d: AppData): number {
  const lv = d.detail.rider;
  let n = 0;
  if (lv < 2) {
    if (d.body.armLength != null) n++;
    if (d.body.ankling !== 'neutral') n++;
    if (d.effort != null) n++;
    if (d.hands != null) n++;
  }
  if (lv < 3) n += Object.keys(d.body.overrides).length;
  return n;
}
