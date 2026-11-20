import type { ParamKey } from '../model/types';

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

export const isPreset = (x: unknown): x is Preset => x === 'tools' || x === 'parts' || x === 'all';

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

/** The preset whose knobs Fit my bike lists: the locks' own preset, else the smallest one covering every unlocked knob. */
export function scopeOf(locks: Partial<Record<ParamKey, boolean>>): Preset {
  const p = presetOf(locks);
  if (p !== 'custom') return p;
  const free = KNOB_ORDER.filter((k) => !locks[k]);
  return (['tools', 'parts', 'all'] as Preset[]).find((s) => free.every((k) => PRESET_FREE[s].includes(k))) ?? 'all';
}
