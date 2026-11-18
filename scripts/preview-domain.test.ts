import { describe, expect, it } from 'vitest';
import { previewHost } from './preview-domain';

describe('previewHost', () => {
  it('puts a branch under the apex', () => expect(previewHost('size-walk')).toBe('size-walk.bikefitter.app'));
  it('makes any branch name one DNS label', () => {
    expect(previewHost('Feature/Size_Walk')).toBe('feature-size-walk.bikefitter.app');
    expect(previewHost('x'.repeat(80))).toBe(`${'x'.repeat(63)}.bikefitter.app`);
  });
  it('refuses reserved names', () => {
    for (const b of ['main', 'dev', 'www']) expect(() => previewHost(b)).toThrow('reserved');
    expect(() => previewHost('///')).toThrow('no hostname');
  });
});
