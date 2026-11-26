import { describe, expect, it } from 'vitest';
import { changeList } from './advice';
import { DEFAULT_PARAMS } from './presets';

describe('changeList', () => {
  it('says how to level a nose-down saddle', () => {
    const c = changeList({ ...DEFAULT_PARAMS, saddleTilt: -4 }, DEFAULT_PARAMS);
    expect(c.map((x) => x.text)).toEqual(['Level the saddle (now 4° nose down)']);
  });
  it('says which way to rotate the bars', () => {
    const c = changeList(DEFAULT_PARAMS, { ...DEFAULT_PARAMS, barRoll: 3 });
    expect(c.map((x) => x.text)).toEqual(['Rotate the bars up 3°']);
    expect(changeList({ ...DEFAULT_PARAMS, barRoll: 3 }, DEFAULT_PARAMS)[0].text).toBe('Rotate the bars down 3°');
  });
});
