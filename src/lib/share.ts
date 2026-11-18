import { migrate, type AppData } from './appData';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** The setup with only the active frame, for a link. */
export function encodeShare(d: AppData): string {
  const frame = d.frames.find((f) => f.id === d.activeFrameId) ?? d.frames[0];
  return toBase64Url(JSON.stringify({ ...d, frames: [frame], activeFrameId: frame.id, tab: 'mybike' }));
}

export function decodeShare(s: string): AppData | null {
  if (!s) return null;
  try {
    return migrate(JSON.parse(fromBase64Url(s)));
  } catch {
    return null;
  }
}
