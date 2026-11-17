import { describe, expect, it } from 'vitest';
import { defaults, hiddenRiderValues, migrate } from './appData';
import { presetLocks } from './knobs';

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
    delete v1.locks.cleatOffset;
    delete v1.body.shoeSizeAuto;
    delete v1.body.sex;
    v1.frames = v1.frames.map((f: any) => {
      const { tyreWidth: _t, ...rest } = f;
      return rest;
    });
    const m = migrate(v1)!;
    expect(m.v).toBe(2);
    expect(m.current.cleatOffset).toBe(5);
    expect(m.frames[0].tyreWidth).toBe(30);
    expect(m.detail).toEqual({ rider: 1, bikeFull: false, results: 1 });
    expect(m.locks).toEqual(presetLocks('parts'));
    expect(m.locks.cleatOffset).toBe(false);
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
  it('new data starts without a setup', () => {
    expect(defaults().hasSetup).toBe(false);
  });
  it('new data opens on the Rider tab with the guide', () => {
    expect(defaults().tab).toBe('rider');
    expect(defaults().seenIntro).toBe(false);
  });
  it('stored data with a changed baseline keeps tune mode', () => {
    const changed: any = defaults();
    delete changed.hasSetup;
    changed.baseline.saddleHeight = 720;
    expect(migrate(changed)!.hasSetup).toBe(true);
    const same: any = defaults();
    delete same.hasSetup;
    expect(migrate(same)!.hasSetup).toBe(false);
  });
});

describe('detail and locks', () => {
  it('folds old section overrides into the levels and keeps stored locks', () => {
    const d: any = defaults();
    d.detail = { global: 1, overrides: { setup: 3 } };
    d.locks = { ...presetLocks('all'), spacers: true };
    const m = migrate(d)!;
    expect(m.detail).toEqual({ rider: 3, bikeFull: true, results: 3 });
    expect(m.locks.spacers).toBe(true);
  });
  it('maps an old Simple level to the New parts locks', () => {
    const d: any = defaults();
    d.detail = { global: 1 };
    d.locks = presetLocks('all');
    expect(migrate(d)!.locks).toEqual(presetLocks('parts'));
  });
  it('round-trips the new shape', () => {
    const d: any = defaults();
    d.detail = { rider: 2, bikeFull: false, results: 3 };
    d.locks = presetLocks('tools');
    const m = migrate(d)!;
    expect(m.detail).toEqual({ rider: 2, bikeFull: false, results: 3 });
    expect(m.locks).toEqual(presetLocks('tools'));
  });
  it('clamps junk levels', () => {
    const d: any = defaults();
    d.detail = { rider: 7, bikeFull: 'x', results: 0 };
    expect(migrate(d)!.detail).toEqual({ rider: 3, bikeFull: false, results: 1 });
  });
  it('counts values hidden by the rider level', () => {
    const d = defaults();
    expect(hiddenRiderValues(d)).toBe(0);
    d.body.armLength = 700;
    d.body.ankling = 'toePoint';
    d.effort = 'hard';
    d.body.overrides = { femur: 440 };
    expect(hiddenRiderValues(d)).toBe(4);
    d.detail.rider = 2;
    expect(hiddenRiderValues(d)).toBe(1);
    d.detail.rider = 3;
    expect(hiddenRiderValues(d)).toBe(0);
  });
});
