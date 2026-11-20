import { describe, expect, it } from 'vitest';
import { defaults } from './appData';
import { KNOB_ORDER, PRESET_FREE, presetLocks, presetOf, scopeOf, type Preset } from './knobs';

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
  it('round-trips through presetOf', () => {
    for (const p of ['tools', 'parts', 'all'] as Preset[]) expect(presetOf(presetLocks(p))).toBe(p);
  });
  it('reports custom for a mix and all for no locks', () => {
    expect(presetOf({ ...presetLocks('parts'), spacers: true })).toBe('custom');
    expect(presetOf({})).toBe('all');
  });
  it('new data pins nothing', () => {
    expect(defaults().locks).toEqual(presetLocks('all'));
  });
});

describe('scopeOf', () => {
  it('maps each preset to itself', () => {
    for (const p of ['tools', 'parts', 'all'] as Preset[]) expect(scopeOf(presetLocks(p))).toBe(p);
  });
  it('picks the smallest preset covering every unlocked knob', () => {
    expect(scopeOf({ ...presetLocks('parts'), spacers: true })).toBe('parts');
    expect(scopeOf({ ...presetLocks('tools'), crankLength: false })).toBe('all');
    expect(scopeOf({ ...presetLocks('tools'), stemLength: false })).toBe('parts');
    expect(scopeOf({})).toBe('all');
  });
});
