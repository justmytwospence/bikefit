import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter, PartialSize } from '../types';

const BASE = 'www.trekbikes.com/us/en_US/bikes/';
// Drop-bar model lines sold since 2019; the slug of a product URL starts with one of them.
const LINES = /^(madone|emonda|domane|checkpoint|checkmate|boone|crockett)\b/;
// Header keys of the Vue geometry component (2022 on) to labels geometryTables knows.
const HEADERS: Record<string, string> = {
  geometryFrameSizeNumber: 'Size',
  geometrySeattube: 'Seat tube',
  geometryAngleSeattube: 'Seat tube angle',
  geometryLengthHeadtube: 'Head tube length',
  geometryAngleHead: 'Head angle',
  geometryBBDrop: 'Bottom bracket drop',
  geometryLengthChainstay: 'Chainstay length',
  geometryWheelbase: 'Wheelbase',
  geometryFrameReach: 'Frame reach',
  geometryFrameStack: 'Frame stack',
};

/** 2022 on: rows sit in a <template> of <geometry-container>, the column keys in its :headers attribute. */
function vueTables(html: string): PartialSize[][] {
  for (const raw of html.match(/<geometry-container[\s\S]*?<\/geometry-container>/g) ?? []) {
    let headers: string[] = [];
    try {
      headers = JSON.parse((raw.match(/:headers=(["'])([\s\S]*?)\1/)?.[2] ?? '[]').replace(/&quot;/g, '"'));
    } catch {
      continue;
    }
    const rows = raw.match(/<tr[\s\S]*?<\/tr>/g) ?? [];
    if (!headers.length || !rows.length) continue;
    const head = `<tr>${headers.map((h) => `<th>${HEADERS[h] ?? h}</th>`).join('')}</tr>`;
    const t = geometryTables(`<table>${head}${rows.join('')}</table>`);
    if (t.length) return t;
  }
  return [];
}

const ascii = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** The model line, carbon or alloy tier and generation: 'Domane SLR 7 AXS Gen 4' -> 'Domane Gen 4'. */
function trekModel(title: string): string | null {
  const t = ascii(title).replace(/\s+/g, ' ').trim();
  const m = t.match(/^(Madone|Emonda|Domane|Checkpoint|Checkmate|Boone|Crockett)\b\s*(.*)$/i);
  if (!m || t.includes('+') || /women/i.test(t)) return null;
  const line = m[1].toLowerCase();
  const rest = m[2];
  const gen = rest.match(/\bGen (\d)\b/i)?.[1];
  const tier = rest.match(/^(SLR|SLX|SL|RSL|ALR|AL|S|LT|HP)\b/i)?.[1]?.toUpperCase();
  if (tier === 'LT' || tier === 'HP') return null;
  const name = line === 'emonda' ? 'Émonda' : m[1][0].toUpperCase() + line.slice(1);
  // Carbon tiers share a frame within a generation; Checkpoint keeps 'SL' to tell it from the ALR.
  let shown = tier && ['AL', 'ALR', 'RSL'].includes(tier) ? tier : '';
  if (line === 'checkpoint' && !shown) shown = 'SL';
  return [name, shown, gen ? `Gen ${gen}` : ''].filter(Boolean).join(' ');
}

const adapter: Adapter = {
  brand: 'Trek',
  file: 'trek',
  prefixes: [
    `${BASE}road-bikes/performance-road-bikes/`, `${BASE}road-bikes/gravel-bikes/`, `${BASE}road-bikes/cyclocross-bikes/`,
    `${BASE}bikepacking-touring-bikes/checkpoint/`,
  ],
  seeds: [],
  accept(url) {
    const u = (() => {
      try {
        return decodeURIComponent(url);
      } catch {
        return url;
      }
    })();
    const m = u.match(/^https?:\/\/www\.trekbikes\.com(?::80)?\/us\/en_US\/bikes\/((?:road-bikes|bikepacking-touring-bikes)\/[^?#]*?)\/([^/?#]+)\/p\/(\d+)\/?(?:[?#].*)?$/);
    if (!m) return null;
    const slug = ascii(m[2]).toLowerCase();
    if (!LINES.test(slug) || /electric|\+|-e-|kids|women/.test(`${m[1]}/${slug}`)) return null;
    const tier = slug.match(/^[a-z0-9]+-(slr|slx|sl|rsl|alr|al|s|lt|hp)\b/)?.[1] ?? '';
    // Domane+ LT and HP are e-bikes whose slugs lose the '+'.
    if (tier === 'lt' || tier === 'hp') return null;
    const gen = slug.match(/-gen-(\d)\b/)?.[1];
    // One family per line, tier, build number and generation: discover then tries several pages of a frame per period,
    // because a discontinued product's later captures show an archive page whose geometry loads by script.
    const line = slug.split('-')[0];
    const num = slug.match(/-(\d)(?:-|$)/)?.[1] ?? (/frameset/.test(slug) ? 'frameset' : '');
    const family = [line, tier, num, gen ? `gen${gen}` : ''].filter(Boolean).join('-');
    const canon = url.replace(/[?#].*$/, '').replace(/^http:/, 'https:').replace(':80/', '/').replace(/\/?$/, '/');
    return { url: canon, family };
  },
  extract(page) {
    // Discontinued products move to an archive page that stays online for years: its capture date says nothing about
    // the model year, so only live product pages count.
    if (page.html.includes('page-bikeArchiveProductDetails')) return [];
    const $ = cheerio.load(page.html);
    $('.sizing-table__alias').remove();
    let tables = geometryTables($.html());
    if (!tables.length) tables = vueTables(page.html);
    if (!tables.length) return [];
    const title = $('h1.buying-zone__title').first().text().trim() || $('title').first().text().split(/\s[|–-]\s/)[0];
    const model = trekModel(title);
    if (!model) return [];
    const category = categoryFrom(model, [
      [/madone/i, 'aero'], [/domane/i, 'endurance'], [/checkpoint|checkmate/i, 'gravel'], [/boone|crockett/i, 'cyclocross'],
    ], 'race');
    // Some 2019 tables repeat every row; keep the first of each size.
    const seen = new Set<string>();
    const sizes = tables[0]
      .map((s) => ({ ...s, size: s.size.replace(/\s*cm$/i, '') }))
      .filter((s) => !seen.has(s.size) && seen.add(s.size));
    // Framesets and some builds list only the sizes they come in; a partial table would read as another geometry.
    if (sizes.length < 5) return [];
    return [{ model, category, sizes }];
  },
};
export default adapter;
