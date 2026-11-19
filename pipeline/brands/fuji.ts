import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

const clean = (s: string) => s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

// Fuji's drop-bar frame lines, longest key first. `disc` keeps 'Disc' in the name where the rim-brake frame differs
// (Roubaix, Sportif); Transonic and SL share one frame between rim and disc builds. `series` keeps the series
// number where it changes the frame (Finest 1.x and 2.x).
const LINES: { key: string; model: string; disc?: true; series?: true }[] = [
  { key: 'transonic', model: 'Transonic' },
  { key: 'sl a', model: 'SL-A' },
  { key: 'sl', model: 'SL' },
  { key: 'supreme', model: 'Supreme' },
  { key: 'roubaix', model: 'Roubaix', disc: true },
  { key: 'gran fondo classico', model: 'Gran Fondo Classico' },
  { key: 'gran fondo', model: 'Gran Fondo' },
  { key: 'sportif', model: 'Sportif', disc: true },
  { key: 'finest', model: 'Finest', series: true },
  { key: 'brevet', model: 'Brevet' },
  { key: 'kasane', model: 'Kasane' },
  { key: 'touring', model: 'Touring' },
  { key: 'jari carbon cx', model: 'Jari Carbon CX' },
  { key: 'jari carbon', model: 'Jari Carbon' },
  { key: 'jari', model: 'Jari' },
  { key: 'altamira cx', model: 'Altamira CX' },
  { key: 'cross', model: 'Cross' },
];
/** Words after the line's name that only say which build this is. Anything else ('frame', 'e', 'team') is not a bike page. */
const BUILD_WORDS = new Set(['disc', 'w', 'rim', 'ltd', 'le', 'us', 'intl', 'usa']);

/** A title or URL slug as lowercase words without build numbers ('SL 1.3 Disc', 'sl-13-disc2', '2022-sl-a-1-3'). */
const wordsOf = (text: string) =>
  text.toLowerCase().split(/[^a-z0-9]+/).map((w) => w.replace(/\d+$/, '')).filter(Boolean);

/** The frame a title or slug names, or null for anything that is not a drop-bar frame line (e-bikes, frames, parts). */
function frameOf(text: string): { model: string; category: FrameCategory; family: string } | null {
  const words = wordsOf(text);
  const line = LINES.find((l) => `${words.join(' ')} `.startsWith(`${l.key} `));
  if (!line) return null;
  const rest = words.slice(line.key.split(' ').length);
  if (!rest.every((w) => BUILD_WORDS.has(w))) return null;
  // Titles say '2.5', slugs '25' or '253' (series, level, page number): the first number's first digit is the series.
  const series = text.toLowerCase().split(/[^a-z0-9]+/).find((w) => /^\d+$/.test(w) && !/^20\d\d$/.test(w))?.[0];
  const model = [line.model, line.series && series && series !== '1' ? series : '', line.disc && rest.includes('disc') ? 'Disc' : '', rest.includes('w') ? 'W' : '']
    .filter(Boolean).join(' ');
  const category = categoryFrom(model, [
    [/^(?:jari carbon cx|altamira|cross)/i, 'cyclocross'], [/^jari/i, 'gravel'], [/^transonic/i, 'aero'], [/^(?:sl|supreme)\b/i, 'race'],
  ], 'endurance');
  return { model, category, family: model.toLowerCase().replace(/\s+/g, '-') };
}

/** The page title as the model's name: without the site, 'Bike Archives' and the archive's model year. */
function titleOf($: cheerio.CheerioAPI): string {
  const t = clean($('title').first().text()) || clean($('meta[property="og:title"]').attr('content') ?? '') || clean($('h1').first().text());
  return t
    .replace(/^Fuji Bikes\s*\|\s*/i, '')
    .replace(/\s*\|\s*Bike Archives$/i, '')
    .replace(/\s+[–-]\s+Fuji Bikes.*$/i, '')
    .replace(/^20\d\d\s+/, '');
}

/** Shopify handles say the model year, as a prefix ('2022-transonic-1-1') or a suffix ('transonic-11-22'). */
function handleYear(url: string, timestamp: string): number | undefined {
  const handle = url.match(/\/products\/([a-z0-9-]+)/)?.[1];
  if (!handle) return undefined;
  const short = handle.match(/-(2[1-6])$/)?.[1];
  const y = Number(handle.match(/^(20\d\d)-/)?.[1] ?? (short && `20${short}`));
  // A handle's trailing number could be a build ('transonic-23'), but never a year later than the capture's next one.
  return y && y <= Number(timestamp.slice(0, 4)) + 1 ? y : undefined;
}

/**
 * One size per column, labelled as the page does with the drawing's letter and the centimetres ('XXS 46'): headers
 * read 'XXS(46cm)', or 'XXS' over a 'Bike Size' row of '46cm'. Also drops the letter column, and renames the two
 * labels the shared table reader would misread (see below).
 */
function prepare(html: string): string {
  const $ = cheerio.load(html);
  // Some pages' size guide pairs a letter with its centimetres ('XS / 47') for geometry headers that lack one.
  const cmOf = new Map<string, string | null>();
  $('table.size-guide-table tr').first().children('td,th').each((_, cell) => {
    const m = clean($(cell).text()).match(/^(X{0,3}[SL]|M)\s*\/\s*(\d{2,3}(?:\.\d)?)$/);
    if (m) cmOf.set(m[1], cmOf.has(m[1]) ? null : m[2]);
  });
  $('table').each((_, t) => {
    const rows = $(t).find('tr').toArray();
    const cells = (tr: (typeof rows)[number]) => $(tr).children('td,th').toArray();
    // Rows can lead with the drawing's letter (A, B ... or nothing): drop that column.
    const firsts = rows.slice(1).map((tr) => clean($(cells(tr)[0]).text()));
    if (firsts.length >= 3 && firsts.every((x) => /^[A-Z]?$/.test(x))) rows.forEach((tr) => void $(cells(tr)[0]).remove());
    for (const tr of rows) {
      const [label] = cells(tr);
      if (!label) continue;
      const text = clean($(label).text());
      // 'Headtube Angle' would read as the head tube's length ('headtube' is its synonym), and the effective seat tube
      // would read as the seat tube's length when it comes first.
      if (/^head\s?tube angle/i.test(text)) $(label).text('Head Tube Angle');
      else if (/^seat tube effective/i.test(text)) $(label).text('Effective Seat Tube');
    }
    // The header is 'Size', optionally over a 'Bike Size' row of centimetres.
    const head = rows[0] ? cells(rows[0]) : [];
    if (!head.length || !/^(?:sizes?)?$/i.test(clean($(head[0]).text()))) return;
    const second = rows[1] ? cells(rows[1]) : [];
    const hasSecond = second.length > 0 && /^(?:bike )?sizes?$/i.test(clean($(second[0]).text()));
    head.slice(1).forEach((cell, i) => {
      const text = `${clean($(cell).text())} ${hasSecond ? clean($(second[i + 1]).text()) : ''}`;
      const letters = text.match(/\b(?:X{1,3}[SL]|[SML])\b/)?.[0];
      const cm = text.match(/(\d{2,3}(?:\.\d)?)\s*cm/i)?.[1] ?? (letters ? cmOf.get(letters) ?? undefined : undefined);
      if (letters || cm) $(cell).text([letters, cm].filter(Boolean).join(' '));
    });
    if (hasSecond) $(rows[1]).remove();
  });
  return $.html();
}

const WWW = /^https?:\/\/(?:www\.)?fujibikes\.com(?::80)?\/usa\/bikes\/road\/(competition|endurance|womens|adventure-and-touring|cyclocross|cx)\/([a-z0-9-]+)\/([a-z0-9-]+)\/?(?:[?#].*)?$/i;
const ARCHIVE = /^https?:\/\/archive\.fujibikes\.com(?::80)?\/(20(?:18|19|20|21))\/Fuji\/([a-z0-9-]+)\/?(?:[?#].*)?$/;
const SHOP = /^https?:\/\/(?:www\.)?fujibikes\.com(?::80)?\/products\/([a-z0-9-]+)\/?(?:[?#].*)?$/;

const adapter: Adapter = {
  brand: 'Fuji',
  file: 'fuji',
  // fujibikes.com is gone (no DNS since 2026): everything is in the archive. Three templates, newest last: the 2018-2022
  // site, the per-year spec archive for model years 2018 to 2021, and the Shopify store (2022 to 2026).
  prefixes: [
    'www.fujibikes.com/usa/bikes/road/',
    'archive.fujibikes.com/2018/Fuji/',
    'archive.fujibikes.com/2019/Fuji/',
    'archive.fujibikes.com/2020/Fuji/',
    'archive.fujibikes.com/2021/Fuji/',
    'www.fujibikes.com/products/',
  ],
  seeds: [],
  accept(url) {
    let m = url.match(WWW);
    if (m) {
      const f = frameOf(m[3]);
      return f && { url: `https://www.fujibikes.com/usa/bikes/road/${m[1].toLowerCase()}/${m[2].toLowerCase()}/${m[3].toLowerCase()}`, family: f.family };
    }
    m = url.match(ARCHIVE);
    if (m) {
      const f = frameOf(m[2]);
      return f && { url: `https://archive.fujibikes.com/${m[1]}/Fuji/${m[2]}`, family: f.family };
    }
    m = url.match(SHOP);
    const f = m && frameOf(m[1]);
    return m && f ? { url: `https://www.fujibikes.com/products/${m[1]}`, family: f.family } : null;
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    const frame = frameOf(titleOf($));
    if (!frame) return [];
    const tables = geometryTables(prepare(page.html));
    // A page can label every size '0' (finest-2-5-le): sizes the build could not tell apart.
    const sizes = tables.sort((a, b) => b.length - a.length)[0];
    if (!sizes || new Set(sizes.map((x) => x.size)).size !== sizes.length) return [];
    // Archive pages say '2020 Jari Carbon 1.1 | Bike Archives'; Shopify handles end in the year; the 2018-2022 site has none.
    const canonical = $('link[rel="canonical"]').attr('href') ?? page.url;
    const year = Number(clean($('title').first().text()).match(/^Fuji Bikes\s*\|\s*(20\d\d)\s/)?.[1]) || handleYear(canonical, page.timestamp);
    return [{ model: frame.model, year, category: frame.category, sizes }];
  },
};
export default adapter;
