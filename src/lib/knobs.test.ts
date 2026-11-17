import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../model/presets';
import { defaults } from './appData';
import { fixedSummary, KNOB_ORDER, PRESET_FREE, presetLocks, presetOf, type Preset } from './knobs';

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
  it('new data starts on New parts', () => {
    expect(defaults().locks).toEqual(presetLocks('parts'));
  });
});

describe('fixedSummary', () => {
  it('lists fixed knobs in the order given', () => {
    expect(fixedSummary(['seatpostSetback', 'cleatOffset', 'crankLength'], DEFAULT_PARAMS, 50))
      .toBe('Seatpost 15 mm setback · Cleats 5 mm back · Cranks 172.5 mm');
    expect(fixedSummary(['stemAngle', 'railOffset'], DEFAULT_PARAMS, 49.6))
      .toBe('Stem −6° · Saddle nose 50 mm behind the BB');
  });
});
