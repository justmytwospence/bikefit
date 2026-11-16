import { describe, expect, it } from 'vitest';
import { defaults, effectiveLocks, hiddenRiderValues, level, migrate } from './appData';

describe('migrate', () => {
  it('upgrades v1 data', () => {
    const v1: any = defaults();
    v1.v = 1;
    delete v1.detail;
    delete v1.effort;
    delete v1.hands;
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
    expect(m.detail.global).toBe(1);
    expect(m.locks.cleatOffset).toBe(false);
    expect(m.body.shoeSize).toBe(43);
    expect(m.body.shoeSizeAuto).toBe(false);
    expect(m.body.sex).toBe('male');
    expect(m.units).toBe('metric');
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
});

describe('detail levels', () => {
  it('locks hidden knobs at Simple and passes locks through otherwise', () => {
    const none = defaults().locks;
    const l1 = effectiveLocks(1, none);
    expect(Object.keys(l1).filter((k) => l1[k as keyof typeof l1]).sort()).toEqual(['cleatOffset', 'crankLength', 'seatpostSetback']);
    const mine = { ...none, spacers: true };
    expect(effectiveLocks(2, mine)).toEqual(mine);
  });
  it('section overrides win over the global level', () => {
    const d = defaults();
    d.detail = { global: 1, overrides: { setup: 3 } };
    expect(level(d, 'setup')).toBe(3);
    expect(level(d, 'rider')).toBe(1);
  });
  it('counts values hidden by the rider level', () => {
    const d = defaults();
    expect(hiddenRiderValues(d)).toBe(0);
    d.body.armLength = 700;
    d.body.ankling = 'toePoint';
    d.effort = 'hard';
    d.body.overrides = { femur: 440 };
    expect(hiddenRiderValues(d)).toBe(4);
    d.detail.overrides.rider = 2;
    expect(hiddenRiderValues(d)).toBe(1);
    d.detail.overrides.rider = 3;
    expect(hiddenRiderValues(d)).toBe(0);
  });
});
