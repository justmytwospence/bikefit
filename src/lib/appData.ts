import { DEFAULT_BODY, DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS, EXAMPLE_FRAMES } from '../model/presets';
import type { Units } from './units';
import type {
  Body, Components, Effort, FitParams, Frame, HandsPref, ParamKey, PartOptions, StyleId,
} from '../model/types';

export type Tab = 'rider' | 'bike' | 'fit' | 'compare';
export type Level = 1 | 2 | 3;
export type SectionId = 'rider' | 'bike' | 'setup' | 'results';

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
  detail: { global: Level; overrides: Partial<Record<SectionId, Level>> };
  units: Units;
  /** False until the user says they have a bike set up; until then Optimize suggests a build from scratch. */
  hasSetup: boolean;
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
    locks: {
      saddleHeight: false, railOffset: false, seatpostSetback: false, spacers: false,
      stemLength: false, stemAngle: false, crankLength: false, cleatOffset: false,
    },
    tab: 'fit' as Tab,
    effort: null,
    hands: null,
    detail: { global: 1 as Level, overrides: {} },
    units: 'metric' as Units,
    hasSetup: false,
  });
}

/** Accepts v1 or v2 saved data and fills anything missing from the defaults. */
export function migrate(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, any>;
  if ((d.v !== 1 && d.v !== 2) || !Array.isArray(d.frames) || d.frames.length === 0) return null;
  const base = defaults();
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
    locks: { ...base.locks, ...d.locks },
    detail: { ...base.detail, ...d.detail },
    frames: d.frames.map((f: Frame) => ({ ...f, tyreWidth: f.tyreWidth ?? 30 })),
    effort: d.effort ?? null,
    hands: d.hands ?? null,
    units: d.units === 'imperial' ? 'imperial' : 'metric',
    hasSetup: typeof d.hasSetup === 'boolean'
      ? d.hasSetup
      : (Object.keys(base.baseline) as ParamKey[]).some(
        (k) => d.baseline?.[k] !== undefined && d.baseline[k] !== base.baseline[k],
      ),
  } as AppData;
}

export function level(d: Pick<AppData, 'detail'>, s: SectionId): Level {
  return d.detail.overrides[s] ?? d.detail.global;
}

/** At the Simple setup level only the visible knobs may be changed by the optimizer. */
export function effectiveLocks(setupLevel: Level, locks: Record<ParamKey, boolean>): Record<ParamKey, boolean> {
  if (setupLevel === 1) {
    return {
      saddleHeight: false, railOffset: false, spacers: false, stemLength: false, stemAngle: false,
      seatpostSetback: true, crankLength: true, cleatOffset: true,
    };
  }
  return { ...locks };
}

export function hiddenRiderValues(d: AppData): number {
  const lv = level(d, 'rider');
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
