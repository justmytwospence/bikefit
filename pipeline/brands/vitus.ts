import * as cheerio from 'cheerio';
import { RANGES, type GeometryKey } from '../../src/data/schema';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter, PartialSize } from '../types';

// vitusbikes.com: WordPress until about December 2019 (/products/<slug>/ with a trailing slash, the geometry an image),
// then Shopify (/products/<handle> without one, the geometry a table). Only the Shopify pages are accepted, so the
// prefixes below stop at the road, gravel and cross families and leave out the mountain, kids, urban and e-bike ranges.
// Early Shopify handles carry no 'vitus-' (vitesse-evo-cr-road-bike-105, zx1-cr-road-bike-105, razor-disc-road-bike-claris).
const URL_RE = /^https?:\/\/(?:www\.)?vitusbikes\.com(?::80)?\/products\/((?:vitus-)?(?:vitesse-evo|zx-?1|venon-evo|substance|energie|razor|zenium)(?:-[a-z0-9]+)*)(?:[?#].*)?$/;

/** Not drop-bar road bikes: kids and youth, flat-bar variants (-fb-, Substance V Flat Bar), time trial, e-bikes, duplicate shop pages. */
const SKIP = /^copy-of-|(?:^|-)(?:youth|kids?|fb|flat|tt|mach|auro|e|ebike|mountain)(?:-|$)/;

/** The frame a handle shows, used to group pages of one frame for discovery. */
function familyOf(handle: string): string {
  const h = handle.replace(/^vitus-/, '');
  if (/^vitesse/.test(h)) return 'vitesse-evo';
  if (/^zx/.test(h)) return 'zx-1-evo';
  if (/^venon/.test(h)) return 'venon-evo';
  if (/^zenium/.test(h)) return 'zenium';
  if (/^razor/.test(h)) return 'razor';
  if (/^energie-evo/.test(h)) return 'energie-evo';
  if (/^energie-crx?-/.test(h)) return 'energie-carbon';
  if (/^energie/.test(h)) return 'energie';
  if (/^substance-(?:cr|crs|crx|carbon)(?:-|$)/.test(h)) return 'substance-carbon';
  if (/^substance-(?:srs|steel)(?:-|$)/.test(h)) return 'substance-steel';
  return 'substance';
}

/**
 * Each frame has its own size chart (the page's 'Geometry Page' tag names it), shared by every build of the frame.
 * The tag is the surest name; the title is the fallback.
 */
const FRAMES: [RegExp, string][] = [
  [/vitesse/i, 'Vitesse EVO'],
  [/zx-?1/i, 'ZX-1 EVO'],
  // The EVO-RS (aero all-road) and EVO-GR (gravel) share one frame, and one chart.
  [/venon/i, 'Venon EVO'],
  [/zenium/i, 'Zenium'],
  [/razor/i, 'Razor'],
  [/energie[ -]evo/i, 'Energie EVO'],
  [/energie[ -]carbon|energie[ -]crx?\b/i, 'Energie Carbon'],
  [/energie/i, 'Energie'],
  [/substance[ -](?:carbon|crx?s?\b)/i, 'Substance Carbon'],
  [/substance[ -](?:steel|srs)/i, 'Substance Steel'],
  [/substance/i, 'Substance'],
];

const SIZE_WORDS: Record<string, string> = {
  'x-small': 'XS', xsmall: 'XS', small: 'S', medium: 'M', large: 'L', 'x-large': 'XL', xlarge: 'XL', 'xx-large': 'XXL', xxlarge: 'XXL',
};

/** 'XS/50', 'XS (50)' and 'X-Small' all read XS, so the charts of one frame over the years list the same sizes. */
function sizeLabel(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  const word = SIZE_WORDS[t.toLowerCase()];
  if (word) return word;
  return t.match(/^([A-Za-z]{1,3})\s*(?:[/(]\s*\d+\)?)$/)?.[1].toUpperCase() ?? t;
}

/** Headers spell the angles 'HT Angle', 'Headtube Angle', 'Seattube Angle'; labels.ts reads 'headtube' as the head tube's length. */
function labelFor(text: string): string {
  const t = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\(?[A-Z]\)\s*/, '');
  if (/^(?:head\s*tube|ht)\s*angle/i.test(t)) return 'Head Tube Angle';
  if (/^(?:seat\s*tube|st)\s*angle/i.test(t)) return 'Seat Tube Angle';
  return t;
}

const OPTIONAL: GeometryKey[] = ['seatTubeLength', 'headTubeLength', 'chainstay', 'wheelbase', 'bbDrop'];
const REQUIRED: GeometryKey[] = ['stack', 'reach', 'seatTubeAngle', 'headTubeAngle'];
const inRange = (k: GeometryKey, v: number | undefined) => v !== undefined && v >= RANGES[k][0] && v <= RANGES[k][1];

/**
 * Charts carry typos: a seat tube of 5000mm, and on the 2020 Vitesse EVO CR page reach values in the first three
 * wheelbase cells (372, 380, 385 beside 1000, 1012, 1021). A value out of range goes; a wheelbase row with one
 * is wrong in every cell, so it goes whole. A size missing a required value goes too.
 */
function clean(sizes: PartialSize[]): PartialSize[] {
  const out = sizes
    .filter((s) => REQUIRED.every((k) => inRange(k, s[k])))
    .map((s) => ({ ...s }));
  if (sizes.some((s) => s.wheelbase !== undefined && !inRange('wheelbase', s.wheelbase))) for (const s of out) delete s.wheelbase;
  for (const s of out) for (const k of OPTIONAL) if (s[k] !== undefined && !inRange(k, s[k])) delete s[k];
  return out;
}

const adapter: Adapter = {
  brand: 'Vitus',
  file: 'vitus',
  prefixes: [
    'vitusbikes.com/products/vitus-vitesse-evo', 'vitusbikes.com/products/vitus-zx-1', 'vitusbikes.com/products/vitus-venon-evo',
    'vitusbikes.com/products/vitus-substance', 'vitusbikes.com/products/vitus-energie', 'vitusbikes.com/products/vitus-razor',
    'vitusbikes.com/products/vitus-zenium', 'vitusbikes.com/products/vitesse-evo', 'vitusbikes.com/products/zx1',
    'vitusbikes.com/products/substance-', 'vitusbikes.com/products/energie-', 'vitusbikes.com/products/razor-',
    'vitusbikes.com/products/zenium-',
  ],
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    if (!m || SKIP.test(m[1])) return null;
    return { url: `https://vitusbikes.com/products/${m[1]}`, family: familyOf(m[1]) };
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    const table = $('#crc_sizechart').first();
    if (!table.length) return [];
    // The chart opens with a 'Model / Size' or 'Frame Size' row; rows above it (2020) would be read as sizes.
    const rows = table.find('tr');
    const head = rows.toArray().findIndex((tr) => /\bsize\b/i.test($(tr).children().first().text()));
    if (head < 0) return [];
    rows.slice(0, head).remove();
    const first = table.find('tr').first();
    first.children().slice(1).each((_, c) => void $(c).text(sizeLabel($(c).text())));
    let tyre: number | undefined;
    table.find('tr').slice(1).each((_, tr) => {
      const cells = $(tr).children();
      const label = labelFor(cells.first().text());
      // The seat tube's centre-to-centre length repeats the centre-to-top one.
      if (/^seat\s*tube.*\bc\s*-?\s*c\b/i.test(label)) {
        $(tr).remove();
        return;
      }
      if (/^max\.?\s*tyre/i.test(label)) {
        // '700 x 45c', '700 x 28c Rim / 700 x 30c Disc': the widest the disc frame takes is the last.
        const w = [...cells.eq(1).text().matchAll(/x\s*(\d{2})\s*c\b/gi)].pop()?.[1];
        if (w) tyre = Number(w);
      }
      cells.first().text(label);
    });
    const sizes = clean(geometryTables($.html(table))[0] ?? []);
    if (sizes.length < 2) return [];
    // The product JSON ('"tags":[..., "Geometry Page: 2021-zx-1-evo", ..., "Model Year: 2022"]') names the frame and the year.
    const tags = page.html.match(/"tags":\[[^\]]*"Model Year: ?20\d\d"[^\]]*\]/)?.[0] ?? '';
    const geo = tags.match(/"Geometry Page: ?([^"]+)"/)?.[1] ?? '';
    const title = $('h1').first().clone().children().remove().end().text().trim() || $('title').text().split(/\s[–|-]\s|&ndash;/)[0].trim();
    const frame = FRAMES.find(([re]) => re.test(geo)) ?? FRAMES.find(([re]) => re.test(title));
    if (!frame) return [];
    const year = Number(tags.match(/"Model Year: ?(20\d\d)"/)?.[1]) || undefined;
    const category = categoryFrom(frame[1], [
      [/^Vitesse/, 'race'], [/^ZX/, 'aero'], [/^(?:Zenium|Razor)/, 'endurance'], [/^Energie/, 'cyclocross'],
    ], 'gravel');
    return [{ model: frame[1], year, category, sizes, tyreWidth: tyre && tyre >= 25 && tyre <= 60 ? tyre : undefined }];
  },
};
export default adapter;
