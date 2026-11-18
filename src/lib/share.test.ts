import { describe, expect, it } from 'vitest';
import { defaults } from './appData';
import { decodeShare, encodeShare } from './share';
import { TEST_FRAMES } from '../model/testFrames';

const withFrames = () => ({ ...defaults(), frames: structuredClone(TEST_FRAMES) });

describe('share links', () => {
  it('round-trips body, setup and only the active frame', () => {
    const d = withFrames();
    d.body.height = 1650;
    d.current.saddleHeight = 701.5;
    d.activeFrameId = d.frames[2].id;
    const out = decodeShare(encodeShare(d))!;
    expect(out.body.height).toBe(1650);
    expect(out.current.saddleHeight).toBe(701.5);
    expect(out.frames.map((f) => f.id)).toEqual([d.frames[2].id]);
    expect(out.activeFrameId).toBe(d.frames[2].id);
    expect(out.tab).toBe('mybike');
  });
  it('keeps accented frame names', () => {
    const d = withFrames();
    d.activeFrameId = d.frames[1].id;
    d.frames[1].name = 'Cervélo Áspero';
    expect(decodeShare(encodeShare(d))!.frames[0].name).toBe('Cervélo Áspero');
  });
  it('rejects junk', () => {
    expect(decodeShare('junk')).toBeNull();
    expect(decodeShare('')).toBeNull();
  });
});
