/**
 * Anonymous, cookie-free usage counts through Vercel Web Analytics, plus Speed Insights. Every event the app
 * sends goes through `event` here. Never put a body measurement, a setup number or a name the user typed in an
 * event: catalog bike names, choices and catalog search text only. Vercel Pro keeps two properties per event.
 *
 * Events: App opened, Tab opened, Intro dismissed, Style chosen, Measurements opened, Measurement entered,
 * Target chosen, Change rejected, Change restored, Inseam matched, Frame chosen, Find bikes, Compare saved, Bike shown,
 * Bike made mine, Bike search, View level, Units, Exported, Imported, Link copied, About link, Error.
 */
import { inject, track } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

export type Props = Record<string, string | number | boolean | null>;
type Send = (name: string, props?: Props) => void;

const MAX_QUEUE = 50;
const MAX_STRING = 120;
const MAX_ERRORS = 5;

let send: Send | null = null;
const queue: [string, Props | undefined][] = [];
const sent = new Set<string>();
let errors = 0;

function cut(props?: Props): Props | undefined {
  if (!props) return undefined;
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) out[k] = typeof v === 'string' ? v.slice(0, MAX_STRING) : v;
  return out;
}

export function event(name: string, props?: Props): void {
  const p = cut(props);
  if (send) send(name, p);
  else if (queue.length < MAX_QUEUE) queue.push([name, p]);
}

/** Sends this name with these properties at most once per page load. */
export function eventOnce(name: string, props?: Props): void {
  const key = name + JSON.stringify(props ?? {});
  if (sent.has(key)) return;
  sent.add(key);
  event(name, props);
}

export function reportError(where: string, e: unknown): void {
  const message = e instanceof Error ? e.message : String(e);
  if (message === 'Superseded' || errors >= MAX_ERRORS) return;
  errors++;
  event('Error', { where, message });
}

/** Starts sending, first whatever was queued before. */
export function connect(s: Send): void {
  send = s;
  for (const [n, p] of queue.splice(0)) s(n, p);
}

/** For tests. */
export function resetAnalytics(): void {
  send = null;
  queue.length = 0;
  sent.clear();
  errors = 0;
}

/** Share links carry the whole body in the hash: never report it. */
export const scrubUrl = (url: string): string => url.split('#')[0];

export function startAnalytics(): void {
  if (!import.meta.env.PROD) return;
  inject({ mode: 'production', beforeSend: (e) => ({ ...e, url: scrubUrl(e.url) }) });
  injectSpeedInsights({ beforeSend: (d) => ({ ...d, url: scrubUrl(d.url) }) });
  connect((n, p) => track(n, p));
  window.addEventListener('error', (ev) => reportError('window', ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportError('promise', ev.reason));
}

/** A catalog bike's name without its size; frames of the user's own are only 'custom'. */
export const bikeOf = (frameId: string, frameName: string): string =>
  frameId.startsWith('cat:') ? frameName.split(' · ')[0] : 'custom';

export const sizeOf = (frameName: string): string => frameName.split(' · ')[1] ?? '';

/** Reports a catalog search once the typing stops, so searches that find nothing show up. */
export function searchLogger(delay = 1500): (query: string, results: number) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = '';
  return (raw, results) => {
    const query = raw.trim().toLowerCase().slice(0, 60);
    if (timer) clearTimeout(timer);
    timer = null;
    if (query.length < 2) return;
    timer = setTimeout(() => {
      timer = null;
      if (query === last) return;
      last = query;
      event('Bike search', { query, results });
    }, delay);
  };
}
