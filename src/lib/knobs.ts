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

export function presetLocks(p: Preset): Record<ParamKey, boolean> {
  const out = {} as Record<ParamKey, boolean>;
  for (const k of KNOB_ORDER) out[k] = !PRESET_FREE[p].includes(k);
  return out;
}
