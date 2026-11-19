import { gunzipSync, inflateRawSync, inflateSync } from 'node:zlib';

let last = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function throttle() {
  const wait = last + 1200 - Date.now();
  last = Math.max(Date.now(), last + 1200);
  if (wait > 0) await sleep(wait);
}

export async function getWithRetry(url: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    await throttle();
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'bikefit-catalog (+https://github.com/justmytwospence/bikefit)' } });
      if (res.status !== 429 && res.status < 500) return res;
      const ra = Number(res.headers.get('retry-after'));
      lastErr = new Error(`HTTP ${res.status} ${url}`);
      await sleep((ra > 0 ? ra : 2 ** attempt * 5) * 1000);
    } catch (e) {
      lastErr = e;
      await sleep(2 ** attempt * 5 * 1000);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export interface CdxRow { timestamp: string; original: string }

export async function cdx(prefix: string, from = '2018', to = String(new Date().getFullYear())): Promise<CdxRow[]> {
  const out: CdxRow[] = [];
  let key = '';
  for (;;) {
    const u = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(prefix)}&matchType=prefix&from=${from}&to=${to}`
      + `&filter=statuscode:200&filter=mimetype:text/html&fl=timestamp,original&output=json&limit=5000&showResumeKey=true`
      + (key ? `&resumeKey=${encodeURIComponent(key)}` : '');
    const res = await getWithRetry(u);
    if (!res.ok) throw new Error(`CDX ${res.status} for ${prefix}`);
    const rows = (await res.json()) as string[][];
    let next = '';
    const body = rows.slice(1);
    for (let i = 0; i < body.length; i++) {
      const r = body[i];
      if (r.length === 1) {
        next = r[0];
        continue;
      }
      if (r.length === 0) continue;
      out.push({ timestamp: r[0], original: r[1] });
    }
    if (!next) break;
    key = next;
  }
  return out;
}

function decode(buf: Buffer): string {
  const head = buf.subarray(0, 2048).toString('latin1');
  const m = head.match(/<meta[^>]+charset=["']?([\w-]+)/i);
  const label = m ? m[1].toLowerCase() : 'utf-8';
  try {
    return new TextDecoder(label).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

/** First non-whitespace byte (after a UTF-8 BOM) opens markup or JSON. */
function looksLikeText(buf: Buffer): boolean {
  let i = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;
  while (i < buf.length && (buf[i] === 0x20 || buf[i] === 0x09 || buf[i] === 0x0a || buf[i] === 0x0d)) i++;
  return i >= buf.length || buf[i] === 0x3c || buf[i] === 0x7b || buf[i] === 0x5b; // < { [
}

/** A capture's bytes as text: gunzipped, or inflated when a crawler stored the body still deflated (Common Crawl, 2019). */
export function decodeBody(buf: Buffer): string {
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  else if (!looksLikeText(buf)) {
    for (const inflate of [inflateRawSync, inflateSync]) {
      try {
        buf = inflate(buf);
        break;
      } catch {
        /* not this encoding */
      }
    }
  }
  return decode(buf);
}

export async function raw(url: string, timestamp: string): Promise<string> {
  const res = await getWithRetry(`https://web.archive.org/web/${timestamp}id_/${url}`);
  if (!res.ok) throw new Error(`Wayback ${res.status} for ${url} @ ${timestamp}`);
  return decodeBody(Buffer.from(await res.arrayBuffer()));
}

export async function latestCapture(url: string, before?: string): Promise<string | null> {
  const res = await getWithRetry(
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&filter=statuscode:200&fl=timestamp&output=json`
    + (before ? `&to=${before}` : '') + '&limit=-1',
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as string[][];
  return rows.length > 1 ? rows[rows.length - 1][0] : null;
}

export async function savePageNow(url: string): Promise<void> {
  try {
    await getWithRetry(`https://web.archive.org/save/${url}`);
    await sleep(20000);
  } catch (e) {
    console.error(`save failed: ${url}: ${e instanceof Error ? e.message : e}`);
  }
}

/** The timestamp of a URL's oldest 200 capture, or null. */
export async function firstCapture(url: string): Promise<string | null> {
  const res = await getWithRetry(
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&filter=statuscode:200&fl=timestamp&output=json&limit=1`,
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as string[][];
  return rows.length > 1 ? rows[1][0] : null;
}
