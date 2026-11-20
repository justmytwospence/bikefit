import { describe, expect, it } from 'vitest';
import { defaults } from './appData';
import { KNOB_ORDER, PRESET_FREE, presetLocks, type Preset } from './knobs';

const free = (p: Preset) => KNOB_ORDER.filter((k) => !presetLocks(p)[k]);

describe('presets', () => {
  it('tools frees the four tool knobs', () => {
    expect(free('tools').sort()).toEqual(['cleatOffset', 'railOffset', 'saddleHeight', 'spacers']);
  });
  it('are cumulative and everything has no locks', () => {
    for (const k of PRESET_FREE.tools) expect(PRESET_FREE.parts).toContain(k);
    for (const k of PRESET_FREE.parts) expect(PRESET_FREE.all).toContain(k);
    expect(Object.values(presetLocks('all')).some(Boolean)).toBe(false);
  });
  it('new data pins nothing', () => {
    expect(defaults().pins).toEqual(presetLocks('all'));
  });
});
