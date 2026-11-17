import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter, PartialSize } from '../types';

// Product slugs: <line>-<h|m|om><build>[-year], h = aluminium, m/om = carbon.
const SLUG = /^(orca-aero|orca|avant|terra-race|terra)-(h|m|om)[a-z0-9-]*$/;
const NAMES: Record<string, string> = {
  // The aluminium Avant H is today's only Avant; the carbon one ended in 2021.
  'orca': 'Orca', 'orca-aero': 'Orca Aero', 'avant': 'Avant Carbon', 'avant-h': 'Avant',
  'terra': 'Terra', 'terra-h': 'Terra H', 'terra-race': 'Terra Race',
};
// 2019-2023 product pages (geometry in a popup), the popups themselves, and the 2026 site.
const PRODUCT = /^https?:\/\/www\.orbea\.com\/us-en\/bicycles\/road\/(?:orca-aero|orca|avant|terra-race|terra)\/cat\/([a-z0-9-]+)\/?$/;
const POPUP = /^https?:\/\/www\.orbea\.com\/us-en\/bicycles\/([a-z0-9-]+)\/geometry\/?$/;
const SITE26 = /^https?:\/\/www\.orbea\.com\/(en-us|en-gb)\/([a-z0-9-]+)\/?$/;

function lineOf(slug: string): string | null {
  const m = slug.match(SLUG);
  if (!m || /gain|ebike/.test(slug)) return null;
  return m[2] === 'h' ? `${m[1]}-h` : m[1];
}

function yearOf(slug: string): number | undefined {
  const y = slug.match(/-(20\d\d|1[89]|2\d)$/)?.[1];
  return y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : undefined;
}

function slugOf(url: string): string | null {
  const u = url.replace(/[?#].*$/, '');
  return u.match(PRODUCT)?.[1] ?? u.match(POPUP)?.[1] ?? u.match(SITE26)?.[2] ?? null;
}

/** Orbea's div grid (2023-2025 product pages) as a table; drops the circled row numbers. */
function normalise(html: string): string {
  const $ = cheerio.load(html);
  $('span[aria-hidden="true"], .cirlcle').remove();
  $('.grid.table-sizes-normal').each((_, g) => {
    const rows = $(g).children('.row').toArray().map((r) => {
      const label = $(r).children('.text, div:not(.cell-centered)').first().text();
      const cells = $(r).children('.cell-centered').toArray().map((c) => $(c).text());
      return [label, ...cells];
    });
    const table = rows.map((r) => `<tr>${r.map((c) => `<td>${c.replace(/[<&]/g, '')}</td>`).join('')}</tr>`).join('');
    $(g).replaceWith(`<table>${table}</table>`);
  });
  $('th, td').each((_, c) => {
    const t = $(c).text().trim();
    const m = t.match(/^\d+\s*-\s*(?=[A-Za-z])/);
    if (m) $(c).text(t.slice(m[0].length));
  });
  return $.html();
}

const adapter: Adapter = {
  brand: 'Orbea',
  file: 'orbea',
  prefixes: [
    'www.orbea.com/us-en/bicycles/',
    'www.orbea.com/en-us/orca', 'www.orbea.com/en-us/avant', 'www.orbea.com/en-us/terra',
    'www.orbea.com/en-gb/orca', 'www.orbea.com/en-gb/avant', 'www.orbea.com/en-gb/terra',
  ],
  seeds: [],
  accept(url) {
    const u = url.replace(/[?#].*$/, '').replace(/^http:/, 'https:').replace(/:80\//, '/');
    const slug = slugOf(u);
    const line = slug && lineOf(slug);
    if (!line) return null;
    // Popups compete in their own family: product pages before 2023 carry no geometry themselves.
    // Slugs with a model year ("-2024") get their own family so a new frame launched mid-period is still picked.
    const year = yearOf(slug);
    return { url: u.replace(/\/$/, ''), family: `${line}${year ? `@${year}` : ''}${POPUP.test(u) ? ':geometry' : ''}` };
  },
  related(html) {
    const href = html.match(/id="geom-link"[^>]*>\s*<a href="(\/us-en\/bicycles\/[a-z0-9-]+\/geometry\/?)"/)?.[1];
    return href ? [`https://www.orbea.com${href}`] : [];
  },
  extract(page) {
    const slug = slugOf(page.url);
    const line = slug && lineOf(slug);
    if (!line) return [];
    let sizes: PartialSize[] | undefined;
    for (const html of [page.html, ...Object.values(page.related)]) {
      sizes = geometryTables(normalise(html)).sort((a, b) => b.length - a.length)[0];
      if (sizes) break;
    }
    if (!sizes) return [];
    const year = yearOf(slug!);
    const category = categoryFrom(line, [[/orca-aero/, 'aero'], [/orca/, 'race'], [/avant/, 'endurance']], 'gravel');
    return [{ model: NAMES[line], year, category, sizes }];
  },
};
export default adapter;
