import { describe, expect, it } from 'vitest';
import { defaults, migrate } from './appData';
import { presetLocks } from './knobs';
import { DEFAULT_OPTIONS } from '../model/presets';

describe('migrate', () => {
  it('upgrades v1 data', () => {
    const v1: any = defaults();
    v1.v = 1;
    delete v1.detail;
    delete v1.effort;
    delete v1.hands;
    delete v1.seenIntro;
    delete v1.hasSetup;
    delete v1.current.cleatOffset;
    v1.locks = presetLocks('parts');
    delete v1.pins;
    delete v1.body.shoeSizeAuto;
    delete v1.body.sex;
    v1.frames = v1.frames.map((f: any) => {
      const { tyreWidth: _t, ...rest } = f;
      return rest;
    });
    const m = migrate(v1)!;
    expect(m.v).toBe(3);
    expect(m.current.cleatOffset).toBe(5);
    expect(m.frames[0].tyreWidth).toBe(30);
    expect(m.detail).toEqual({ bikeFull: false, results: 1 });
    expect(m.riderOpen).toEqual({ ride: false, arms: false, segments: false });
    expect(Object.values(m.pins).some(Boolean)).toBe(false);
    expect('locks' in m).toBe(false);
    expect(m.body.shoeSize).toBe(43);
    expect(m.body.shoeSizeAuto).toBe(false);
    expect(m.body.sex).toBe('male');
    expect(m.units).toBe('metric');
    expect(m.seenIntro).toBe(true);
  });
  it('replaces a stored null shoe size with the default', () => {
    const d: any = defaults();
    d.body.shoeSize = null;
    delete d.body.shoeSizeAuto;
    const m = migrate(d)!;
    expect(m.body.shoeSize).toBe(43);
    expect(m.body.shoeSizeAuto).toBe(true);
  });
  it('rejects junk', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ v: 3 })).toBeNull();
    expect(migrate({ v: 2, frames: [] })).toBeNull();
  });
  it('maps old tab ids', () => {
    const tab = (t: string) => migrate({ ...defaults(), tab: t })!.tab;
    expect(tab('bike')).toBe('mybike');
    expect(tab('fit')).toBe('mybike');
    expect(tab('compare')).toBe('find');
    expect(tab('nonsense')).toBe('rider');
    expect(tab('find')).toBe('find');
  });
  it('new data opens on the Rider tab with the guide', () => {
    expect(defaults().tab).toBe('rider');
    expect(defaults().seenIntro).toBe(false);
  });
  it('drops the old made-up example frames', () => {
    const ex = (id: string) => ({ ...defaults().frames[0], id, name: `Example ${id}` });
    const mine = { ...defaults().frames[0], id: 'mine', name: 'My frame' };
    const d: any = { ...defaults(), frames: [ex('race-54'), ex('endurance-56'), mine], activeFrameId: 'endurance-56' };
    const m = migrate(d)!;
    expect(m.frames.map((f) => f.id)).toEqual(['mine']);
    expect(m.activeFrameId).toBe('mine');
    const only: any = { ...defaults(), frames: [ex('endurance-56')], activeFrameId: 'endurance-56' };
    expect(migrate(only)!.frames).toEqual(defaults().frames);
    expect(migrate(only)!.activeFrameId).toBe(defaults().activeFrameId);
  });
  it('follows a catalog model whose id changed with its years', () => {
    const size = (s: string) => ({ ...defaults().frames[0], id: `cat:trek-domane-gen-4-2020-${s}`, name: `Trek Domane Gen 4 2020–2026 · ${s}` });
    const mine = { ...defaults().frames[0], id: 'mine', name: 'My frame' };
    const d: any = { ...defaults(), frames: [size('56'), mine, size('54'), defaults().frames[0]], activeFrameId: 'cat:trek-domane-gen-4-2020-54' };
    const m = migrate(d)!;
    expect(m.frames.map((f) => f.id)).toEqual(['cat:trek-domane-gen-4-2023-56', 'mine', 'cat:trek-domane-gen-4-2023-54']);
    expect(m.frames[0]).toEqual(defaults().frames[0]);
    expect(m.frames[2].name).toBe('Trek Domane Gen 4 2023–2025 · 54');
    expect(m.activeFrameId).toBe('cat:trek-domane-gen-4-2023-54');
  });
  const v2 = (over: any = {}): any => ({ ...defaults(), v: 2, ...over });
  it('a v2 New build becomes the bike you ride', () => {
    const d = v2({ hasSetup: false });
    d.current.saddleHeight = 720;
    expect(migrate(d)!.baseline).toEqual(migrate(d)!.current);
    expect(migrate(d)!.baseline.saddleHeight).toBe(720);
  });
  it('a v2 setup keeps its baseline', () => {
    const d = v2({ hasSetup: true });
    d.baseline.saddleHeight = 700;
    d.current.saddleHeight = 720;
    expect(migrate(d)!.baseline.saddleHeight).toBe(700);
  });
  it('infers an old setup from a changed baseline', () => {
    const changed = v2();
    delete changed.hasSetup;
    changed.baseline.saddleHeight = 720;
    changed.current.saddleHeight = 730;
    expect(migrate(changed)!.baseline.saddleHeight).toBe(720);
    const same = v2();
    delete same.hasSetup;
    same.current.saddleHeight = 730;
    expect(migrate(same)!.baseline.saddleHeight).toBe(730);
  });
  it('drops old locks', () => {
    const m: any = migrate({ ...defaults(), locks: presetLocks('tools') })!;
    expect(Object.values(m.pins).some(Boolean)).toBe(false);
    expect('locks' in m).toBe(false);
  });
  it('keeps pins', () => {
    expect(migrate({ ...defaults(), pins: { ...presetLocks('all'), crankLength: true } })!.pins.crankLength).toBe(true);
  });
  it('drops scope and hasSetup', () => {
    const m: any = migrate(v2({ scope: 'all', hasSetup: true }))!;
    expect('scope' in m).toBe(false);
    expect('hasSetup' in m).toBe(false);
  });
});

describe('detail', () => {
  it('folds old section overrides into the levels', () => {
    const d: any = defaults();
    delete d.riderOpen;
    d.detail = { global: 1, overrides: { setup: 3 } };
    const m = migrate(d)!;
    expect(m.detail).toEqual({ bikeFull: true, results: 3 });
    expect(m.riderOpen).toEqual({ ride: true, arms: true, segments: true });
  });
  it('round-trips the new shape', () => {
    const d: any = defaults();
    d.detail = { bikeFull: false, results: 3 };
    d.riderOpen = { ride: false, arms: true, segments: false };
    d.pins = { ...presetLocks('all'), spacers: true };
    const m = migrate(d)!;
    expect(m.detail).toEqual({ bikeFull: false, results: 3 });
    expect(m.riderOpen).toEqual({ ride: false, arms: true, segments: false });
    expect(m.pins).toEqual({ ...presetLocks('all'), spacers: true });
  });
  it('opens Rider sections from an old Rider level', () => {
    const d: any = defaults();
    delete d.riderOpen;
    d.detail = { rider: 2, bikeFull: false, results: 1 };
    expect(migrate(d)!.riderOpen).toEqual({ ride: true, arms: true, segments: false });
    d.detail.rider = 3;
    expect(migrate(d)!.riderOpen).toEqual({ ride: true, arms: true, segments: true });
    expect(migrate(d)!.detail).toEqual({ bikeFull: false, results: 1 });
  });
  it('clamps junk levels and open flags', () => {
    const d: any = defaults();
    d.detail = { rider: 7, bikeFull: 'x', results: 0 };
    d.riderOpen = { ride: 'yes', arms: true };
    const m = migrate(d)!;
    expect(m.detail).toEqual({ bikeFull: false, results: 1 });
    expect(m.riderOpen).toEqual({ ride: false, arms: true, segments: false });
  });
});

describe('saved part options', () => {
  it('are replaced by the current ones', () => {
    const old: any = { ...defaults(), options: { ...DEFAULT_OPTIONS, crankLengths: [160, 165, 170, 172.5, 175] } };
    expect(migrate(old)!.options).toEqual(DEFAULT_OPTIONS);
  });
});
