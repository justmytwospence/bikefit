import { describe, expect, it } from 'vitest';
import { buildBranch, previewHost } from './preview-domain';

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

describe('buildBranch', () => {
  const preview = { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'size-walk', PREVIEW_DOMAIN_TOKEN: 't' };

  it('names the branch of a preview build with a token', () => {
    expect(buildBranch(preview)).toEqual({ branch: 'size-walk' });
  });
  it('skips production, local builds, main, dev and a missing token', () => {
    expect(buildBranch({ ...preview, VERCEL_ENV: 'production' })).toHaveProperty('skip');
    expect(buildBranch({})).toHaveProperty('skip');
    expect(buildBranch({ ...preview, VERCEL_GIT_COMMIT_REF: 'dev' })).toHaveProperty('skip');
    expect(buildBranch({ ...preview, VERCEL_GIT_COMMIT_REF: 'main' })).toHaveProperty('skip');
    expect(buildBranch({ ...preview, VERCEL_GIT_COMMIT_REF: undefined })).toHaveProperty('skip');
    expect(buildBranch({ ...preview, PREVIEW_DOMAIN_TOKEN: '' })).toHaveProperty('skip');
  });
});
