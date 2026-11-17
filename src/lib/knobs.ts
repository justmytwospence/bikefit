import type { FitParams, ParamKey } from '../model/types';

export type Preset = 'tools' | 'parts' | 'all';

export const KNOB_ORDER: ParamKey[] = [
  'saddleHeight', 'railOffset', 'seatpostSetback', 'spacers', 'stemLength', 'stemAngle', 'cleatOffset', 'crankLength',
];

const TOOLS: ParamKey[] = ['saddleHeight', 'railOffset', 'spacers', 'cleatOffset'];

/** The knobs Optimize may change at each preset; each preset adds to the one before. */
export const PRESET_FREE: Record<Preset, ParamKey[]> = {
  tools: TOOLS,
  parts: [...TOOLS, 'stemLength', 'stemAngle', 'seatpostSetback'],
  all: KNOB_ORDER,
};

export const PRESETS: { value: Preset; label: string; hint: string }[] = [
  { value: 'tools', label: 'Tools only', hint: 'Saddle height and fore-aft, spacers and cleats: what you can change with tools.' },
  { value: 'parts', label: 'New parts', hint: 'Also a new stem or seatpost.' },
  { value: 'all', label: 'Everything', hint: 'Also crank length.' },
];

export const CUSTOM_HINT = 'Your own mix: the lock on each part sets whether Optimize may change it.';

export function presetLocks(p: Preset): Record<ParamKey, boolean> {
  const out = {} as Record<ParamKey, boolean>;
  for (const k of KNOB_ORDER) out[k] = !PRESET_FREE[p].includes(k);
  return out;
}

export function presetOf(locks: Partial<Record<ParamKey, boolean>>): Preset | 'custom' {
  for (const p of ['tools', 'parts', 'all'] as Preset[]) {
    const want = presetLocks(p);
    if (KNOB_ORDER.every((k) => !!locks[k] === want[k])) return p;
  }
  return 'custom';
}

/** One line naming the fixed knobs and their current values, in the order given. */
export function fixedSummary(keys: ParamKey[], p: FitParams, setback: number): string {
  const angle = p.stemAngle === 0 ? '0°' : (p.stemAngle > 0 ? '+' : '−') + Math.abs(p.stemAngle) + '°';
  const text: Record<ParamKey, string> = {
    saddleHeight: `Saddle height ${p.saddleHeight} mm`,
    railOffset: `Saddle nose ${Math.round(setback)} mm behind the BB`,
    seatpostSetback: p.seatpostSetback === 0 ? 'Inline seatpost' : `Seatpost ${p.seatpostSetback} mm setback`,
    spacers: `${p.spacers} mm spacers`,
    stemLength: `${p.stemLength} mm stem`,
    stemAngle: `Stem ${angle}`,
    cleatOffset: `Cleats ${p.cleatOffset} mm back`,
    crankLength: `Cranks ${p.crankLength} mm`,
  };
  return keys.map((k) => text[k]).join(' · ');
}
