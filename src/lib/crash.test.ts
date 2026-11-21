import { describe, expect, it } from 'vitest';
import { isAppError } from './crash';

const origin = 'https://bikefitter.app';

describe('isAppError', () => {
  it('counts errors from our own scripts and rejected promises', () => {
    expect(isAppError('x is undefined', `${origin}/assets/index.js`, origin)).toBe(true);
    expect(isAppError('boom', undefined, origin)).toBe(true);
  });
  it('ignores extensions and benign browser noise', () => {
    expect(isAppError('boom', 'chrome-extension://abc/content.js', origin)).toBe(false);
    expect(isAppError('ResizeObserver loop completed with undelivered notifications.', `${origin}/`, origin)).toBe(false);
    expect(isAppError('Superseded', undefined, origin)).toBe(false);
  });
});
