import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import { keyFor } from '../lib/labels';
import type { Adapter } from '../types';

// Product pages live at /<locale>/products/<id>-<slug>.html, identical since 2018 in every locale: gb_en carries them all.
// Series are in the slug: SLR (road), ADV (gravel), CXR (cyclocross), AIR (aero) and TRVL (gravel with a suspension fork).
// Product ids below 2100 are bikes sold before 2018 (their archived pages are empty or old), so they stay out.
const URL_RE = /^https?:\/\/www\.boardmanbikes\.com\/gb_en\/products\/(\d+)-((?:20[12]\d-|boardman-)?(slr|adv|cxr|air|trvl)(?:[-.][a-z0-9.-]*)?)\.html(?:[?#].*)?$/i;
/** Electric (adv-8.9e), flat-bar (trvl-8.9-fb), time-trial (air-tt), junior and non-road slugs. */
const REJECT = /\.\de(?:-|$)|(?:^|-)(?:fb|tt|ebike|electric|jnr|junior|kids?|hyb|mht|mtr|mtx|urb|wheelset|seatpost)(?:-|$)/;
/** The first SLR product of the 2025 range: one frame under every name from here on. */
const SLR_2025 = 2418;

/** ADV 8.9 Carbon (2024): its slug, adv-8.9, is the alloy ADV 8.9's (id 2403) too, so only the id says which frame it is. */
const ADV_CARBON_8 = new Set([2402]);

const YEAR = /\b(20[12]\d)\b/;
const womensIn = (s: string) => /women|wmn|\.\dw(?:\b|-)/i.test(s);

/** The frame a product is: pages of one frame get one name, whatever build or colour they show. */
function frameName(series: string, text: string, id: number): string {
  const digit = text.match(new RegExp(`\\b${series}\\b[^0-9]{0,12}([89])\\.\\d`, 'i'))?.[1];
  const disc = /\bdisc\b/i.test(text);
  switch (series) {
    case 'SLR':
      // The 2025 carbon range shares one frame. Before it, 8.x bikes were one (alloy) frame, 9.x another with rim and disc
      // versions, and the Race and Titanium bikes their own.
      if (id >= SLR_2025) return 'SLR';
      if (/\btitanium\b/i.test(text)) return 'SLR Titanium';
      if (/\brace\b/i.test(text)) return 'SLR Race';
      if (digit === '8') return 'SLR 8';
      return disc ? 'SLR 9 Disc' : 'SLR 9';
    case 'ADV': {
      // Alloy frames carry 8.x numbers or say so; carbon ones are 9.x or say Carbon (ADV 8.9 Carbon from 2024).
      const alloy = /\balloy\b/i.test(text) || (!/\bcarbon\b/i.test(text) && digit === '8' && !ADV_CARBON_8.has(id));
      return alloy ? 'ADV Alloy' : 'ADV Carbon';
    }
    default:
      return series;
  }
}

/** The model year a slug states ('2018-cxr-9.4', 'slr-8.8-2021', 'adv-8.62021'). */
const slugYear = (slug: string) => Number(slug.match(/^(20[12]\d)-/)?.[1] ?? slug.match(/(?:-|\d)(20[12]\d)(?:-|$)/)?.[1]) || undefined;

const adapter: Adapter = {
  brand: 'Boardman',
  file: 'boardman',
  prefixes: ['www.boardmanbikes.com/gb_en/products/'],
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    if (!m || Number(m[1]) < 2100 || REJECT.test(m[2].toLowerCase())) return null;
    const slug = m[2].toLowerCase();
    const series = m[3].toUpperCase();
    // One family per frame, era and range (men's or women's), so that discovery tries a page of each. The 2018 and 2019
    // catalogue (ids below 2300) is its own era: most of its pages became empty stubs from 2020, and a frame's later
    // pages must not wait behind them.
    const id = Number(m[1]);
    const name = frameName(series, slug.replace(/-/g, ' '), id);
    const family = [name, womensIn(slug) ? 'womens' : '', slugYear(slug) ?? (id < 2300 ? 2019 : '')].filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { url: `https://www.boardmanbikes.com/gb_en/products/${m[1]}-${m[2]}.html`, family };
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    // The 'Sizes & Fit' block is not a table: a column of label cells, then one list item per size with its values in
    // label order. Rebuild it as a table.
    const cell = (e: Parameters<typeof $>[0]) => $(e).text().replace(/\s+/g, ' ').trim();
    const labels = $('.size-table .size-labels > .size-row').map((_, e) => cell(e)).get();
    let cols: string[][] = $('.size-table ul > li').map((_, li) => [$(li).find('.size-data > .size-row').map((_, e) => cell(e)).get()]).get();
    // Pages before 2020 list a standard and a women's size column (both labels for one geometry): read the standard one.
    const sizeAt = labels.findIndex((l) => /\bsize$/i.test(l) && !/^women/i.test(l));
    if (sizeAt < 0) return [];
    // Where the standard range has no size (a dash), the column is a women's size only: skip it.
    cols = cols.filter((c) => /[a-z0-9]/i.test(c[sizeAt] ?? ''));
    const rows: string[][] = [];
    labels.forEach((l, i) => {
      // Labels lead with the drawing's code (ST Seat Tube, HA Head Angle, BB Bottom Bracket Drop, S Stack).
      const label = l.replace(/^[A-Z]{1,2}\s+(?=[A-Z])/, '');
      if (i === sizeAt) rows.push(['Size', ...cols.map((c) => c[i] ?? '')]);
      // The stack-to-reach ratio would read as a second Stack, and the ranges' stem and crank rows are not geometry.
      else if (keyFor(label) && !/ratio|range/i.test(label)) rows.push([label, ...cols.map((c) => c[i] ?? '')]);
    });
    const table = `<table>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
    const sizes = geometryTables(table)[0];
    if (!sizes) return [];
    const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
    const title = $('head title').first().text().replace(/\s+/g, ' ').trim();
    const [, idText, slug] = page.url.match(/\/products\/(\d+)-([^/?#]+?)(?:\.html)?(?:[?#].*)?$/) ?? [];
    const text = [h1, title, (slug ?? '').replace(/-/g, ' ')].join(' | ');
    const series = h1.match(/\b(SLR|ADV|CXR|AIR|TRVL)\b/i)?.[1].toUpperCase() ?? title.match(/\b(SLR|ADV|CXR|AIR|TRVL)\b/i)?.[1].toUpperCase();
    if (!series) return [];
    // Flat-bar and electric bikes are not drop-bar bikes (TRVL FB, ADV 8.9e).
    if (/\b(?:FB|flat bar)\b|\b\d\.\de\b/i.test(`${h1} ${title}`)) return [];
    let model = frameName(series, text, Number(idText ?? 0));
    // A page showing only women's sizes is a women's frame; one with a standard range column shows the standard frame.
    if (womensIn(`${h1} ${title}`) && !labels.some((l) => /^standard/i.test(l))) model += " Women's";
    // The page states a model year in its heading ('2019 AIR 9.2', 'SLR 9.4 Disc Carbon 2021') or its URL ('...-2021').
    const year = Number(`${h1} ${title}`.match(YEAR)?.[1]) || slugYear(slug ?? '');
    const category = categoryFrom(series, [[/AIR/, 'aero'], [/CXR/, 'cyclocross'], [/ADV|TRVL/, 'gravel']], 'race');
    return [{ model, year, category, sizes }];
  },
};
export default adapter;
