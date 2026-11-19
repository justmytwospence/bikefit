import { deflateRawSync, deflateSync, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodeBody } from './wayback';

const html = '<html><title>x</title></html>';

describe('decodeBody', () => {
  it('passes plain text through', () => expect(decodeBody(Buffer.from(html))).toBe(html));
  it('gunzips', () => expect(decodeBody(gzipSync(html))).toBe(html));
  it('inflates raw deflate', () => expect(decodeBody(deflateRawSync(html))).toBe(html));
  it('inflates zlib deflate', () => expect(decodeBody(deflateSync(html))).toBe(html));
  it('leaves JSON with leading whitespace alone', () => expect(decodeBody(Buffer.from('  {"a":1}'))).toBe('  {"a":1}'));
  it('returns undecodable bytes as text without throwing', () => {
    expect(typeof decodeBody(Buffer.from([0x01, 0x02, 0x03]))).toBe('string');
  });
});
