import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { migrate, type AppData } from './appData';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Everything the app holds, deflated, for a link. */
export function encodeShare(d: AppData): string {
  return toBase64Url(deflateSync(strToU8(JSON.stringify(d)), { level: 9 }));
}

export function decodeShare(s: string): AppData | null {
  if (!s) return null;
  try {
    return migrate(JSON.parse(strFromU8(inflateSync(fromBase64Url(s)))));
  } catch {
    return null;
  }
}

/** The older links: plain base64 JSON of the setup with only the active frame. */
export function decodeOldShare(s: string): AppData | null {
  if (!s) return null;
  try {
    return migrate(JSON.parse(new TextDecoder().decode(fromBase64Url(s))));
  } catch {
    return null;
  }
}

/** The app data in a link's hash (`#z=` now, `#d=` before), or null when it holds none. */
export function readShareHash(hash: string): AppData | null {
  if (hash.startsWith('#z=')) return decodeShare(hash.slice(3));
  if (hash.startsWith('#d=')) return decodeOldShare(hash.slice(3));
  return null;
}
