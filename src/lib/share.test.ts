import { describe, expect, it } from 'vitest';
import { defaults } from './appData';
import { decodeShare, encodeShare, readShareHash } from './share';
import { TEST_FRAMES } from '../model/testFrames';

const withFrames = () => ({ ...defaults(), frames: structuredClone(TEST_FRAMES) });
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('share links', () => {
  it('round-trips every bike, the report and the view', () => {
    const d = withFrames();
    d.body.height = 1650;
    d.current.saddleTilt = -2.5;
    d.activeFrameId = d.frames[2].id;
    d.tab = 'find';
    d.viewPose = 'drops';
    d.report = { label: 'Retül', saddleHeight: 698, seatAngle: 74, saddleSetback: -59, saddleAngle: 0, gripReach: 550, gripDrop: -14, crankLength: 172.5 };
    const out = decodeShare(encodeShare(d))!;
    expect(out.body.height).toBe(1650);
    expect(out.current.saddleTilt).toBe(-2.5);
    expect(out.frames.map((f) => f.id)).toEqual(d.frames.map((f) => f.id));
    expect(out.activeFrameId).toBe(d.frames[2].id);
    expect(out.tab).toBe('find');
    expect(out.viewPose).toBe('drops');
    expect(out.report).toEqual(d.report);
  });
  it('keeps accented frame names', () => {
    const d = withFrames();
    d.frames[1].name = 'Cervélo Áspero';
    expect(decodeShare(encodeShare(d))!.frames[1].name).toBe('Cervélo Áspero');
  });
  it('still reads the older links', () => {
    const d = withFrames();
    d.body.height = 1610;
    const frame = d.frames[1];
    const old = b64(JSON.stringify({ ...d, frames: [frame], activeFrameId: frame.id, tab: 'mybike' }));
    const out = readShareHash(`#d=${old}`)!;
    expect(out.body.height).toBe(1610);
    expect(out.frames.map((f) => f.id)).toEqual([frame.id]);
  });
  it('rejects junk', () => {
    expect(readShareHash('#z=junk')).toBeNull();
    expect(readShareHash('')).toBeNull();
    expect(readShareHash('#d=')).toBeNull();
    expect(decodeShare('')).toBeNull();
  });
  it('is shorter than plain base64 JSON', () => {
    const d = withFrames();
    expect(encodeShare(d).length).toBeLessThan(b64(JSON.stringify(d)).length);
  });
});
