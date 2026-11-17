import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Capture } from '../types';
import { raw } from './wayback';

export const CACHE = join(process.cwd(), '.cache', 'wayback');
export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function store(html: string): string {
  mkdirSync(CACHE, { recursive: true });
  const h = sha256(html);
  const f = join(CACHE, `${h}.html`);
  if (!existsSync(f)) writeFileSync(f, html);
  return h;
}

/** The cached page for a capture, fetching it when missing. Throws when the bytes differ from the pinned hash. */
export async function read(c: Capture): Promise<string> {
  if (c.sha256) {
    const f = join(CACHE, `${c.sha256}.html`);
    if (existsSync(f)) return readFileSync(f, 'utf8');
  }
  const html = await raw(c.url, c.timestamp);
  const h = store(html);
  if (c.sha256 && h !== c.sha256) throw new Error(`Snapshot changed: ${c.url} @ ${c.timestamp}`);
  return html;
}

/** Cached html only, or null (the offline build uses this). */
export function readCached(c: Capture): string | null {
  const f = join(CACHE, `${c.sha256}.html`);
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
}

export async function pin(url: string, timestamp: string): Promise<{ capture: Capture; html: string }> {
  const html = await raw(url, timestamp);
  return { capture: { url, timestamp, sha256: store(html) }, html };
}
