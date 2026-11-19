import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Polygon's drop-bar road and gravel lines: Strattos (endurance), Helios (A aero, LT and C race), Bend (gravel) and
// Tambora (gravel). Three site generations carry a product page with a geometry table:
//   2018      /<region>/bikes/description/<model year>-<slug>             (model year in the path; table, no wheelbase)
//   2019-21   /eur/shop/bikes-eur/road-eur/[<group>/]<slug>/             (table headed by a row of drawing letters)
//   2022 on   /<slug>/ and /us/<slug>[-us]/                              (WooCommerce, table.product-geometry__table)
// Each build (S7D, A9X Dura Ace C60, Entity WR5 ...) has its own page but shares its model's geometry, so the
// model is the line and its code ('Strattos S7D', 'Helios A9X'); builds, colours and the shop's '-2' copies fold into it.
const HOST = /^https?:\/\/(?:www\.)?polygonbikes\.com(?::80)?(\/[^?#]*)/i;
const LEGACY = /^\/(?:id|my|sg|de)\/bikes\/description\/(20\d\d)-([a-z0-9-]+)$/i;
const EUR = /^\/eur\/shop\/bikes-eur\/road-eur\/(?:[a-z-]+\/)?([a-z0-9-]+)$/i;
const ROOT = /^\/(?:us\/)?([a-z0-9-]+)$/i;
const MIN_YEAR = 2018;

/** Reviews, comparisons, series listings and archives share the line's slugs. */
const NOT_A_BIKE = /review|tested|-vs-|comparison|first-look|series|archive|kids|junior|-jr(?:-|$)|e-?bike/;

interface Line { line: string; code: string }

/**
 * The frame a slug names, after the model year and the '-us' suffix are removed. Names the lines but never their
 * flat-bar or electric siblings (Helios F, Bend FX and CT, Tambora AE, Strattos Jr): they do not match.
 */
function lineOf(slug: string): (Line & { serial?: string }) | null {
  const hit = (line: string, code: string, rest: string) => ({
    line, code: code.toUpperCase(), serial: /^\d$/.test(rest) ? rest : undefined,
  });
  let m: RegExpMatchArray | null;
  // Strattos S2 to S8D (the 2018 pages write 'strattos-7'), and Strattos C.
  if ((m = slug.match(/^strattos-(?:s?(\d+[a-z]?)|(c\d+[a-z]?))(?:-|$)(.*)$/))) return hit('Strattos', m[2] ?? `s${m[1]}`, m[3]);
  // Helios A as the 2019-21 shop writes it: helios-a-8-0-x is the A8X.
  if ((m = slug.match(/^helios-a-(\d)-0(-?x)?(?:-|$)(.*)$/))) return hit('Helios', `a${m[1]}${m[2] ? 'x' : ''}`, m[3]);
  // Helios A (aero) and LT (race); a glued or separate x is part of the code (lt9-x is the LT9X).
  if ((m = slug.match(/^helios-(a\d+x?|lt\d+x?)(-x)?(?:-|$)(.*)$/))) return hit('Helios', m[1] + (m[2] ? 'x' : ''), m[3]);
  if ((m = slug.match(/^bend-(r\d+x?|riv|rv|v\d+x?)(?:-|$)(.*)$/))) return hit('Bend', m[1], m[2]);
  if ((m = slug.match(/^tambora-([ga]\d+x?)(?:-|$)(.*)$/))) return hit('Tambora', m[1], m[2]);
  return null;
}

interface Parsed { url: string; family: string; model: string; category: FrameCategory; year?: number }

function parse(url: string): Parsed | null {
  const h = url.match(HOST);
  if (!h) return null;
  const path = h[1].replace(/\/+$/, '');
  let slug: string;
  let year: number | undefined;
  let canonical = path;
  let m: RegExpMatchArray | null;
  if ((m = path.match(LEGACY))) {
    year = Number(m[1]);
    slug = m[2];
  } else if ((m = path.match(EUR))) {
    slug = m[1];
    canonical += '/';
  } else if ((m = path.match(ROOT))) {
    slug = m[1];
    canonical += '/';
  } else return null;
  slug = slug.toLowerCase().replace(/-us$/, '');
  if (NOT_A_BIKE.test(slug)) return null;
  // Superseded pages keep their model year in the slug: strattos-s2-2020.
  const y = slug.match(/-(20\d\d)$/);
  if (y) {
    year = Number(y[1]);
    slug = slug.slice(0, -5);
  }
  if (year !== undefined && year < MIN_YEAR) return null;
  const l = lineOf(slug);
  if (!l) return null;
  const model = `${l.line} ${l.code}`;
  const category = categoryFrom(model, [[/^bend|^tambora/i, 'gravel'], [/^helios a/i, 'aero'], [/^helios/i, 'race']], 'endurance');
  // A year or the shop's '-2' copy (strattos-s2-2 is a later model than strattos-s2) is its own era of the frame.
  const family = `${l.line}-${l.code}${year ? `-${year}` : ''}${l.serial ? `-v${l.serial}` : ''}`.toLowerCase();
  return { url: `https://www.polygonbikes.com${canonical}`, family, model, category, year };
}

const adapter: Adapter = {
  brand: 'Polygon',
  file: 'polygon',
  prefixes: [
    // 2022 on: root and /us/ (other regions mirror them).
    ...['strattos', 'helios', 'bend', 'tambora'].flatMap((l) => [`www.polygonbikes.com/${l}`, `www.polygonbikes.com/us/${l}`]),
    // 2019-21: the road shop.
    'www.polygonbikes.com/eur/shop/bikes-eur/road-eur/',
    // 2018: model year 2018 only (earlier models are not wanted); the Malaysian and Indonesian shops carry the range.
    ...['my', 'id'].flatMap((r) => ['strattos', 'helios', 'bend'].map((l) => `www.polygonbikes.com/${r}/bikes/description/2018-${l}`)),
  ],
  seeds: [],
  accept(url) {
    const p = parse(url);
    return p ? { url: p.url, family: p.family } : null;
  },
  extract(page) {
    const p = parse(page.url);
    if (!p) return [];
    const $ = cheerio.load(page.html);
    // Each cell carries a millimetre and an inch span; keep the millimetres.
    $('.inch').remove();
    // 2022 on: the first of the tables is the frame as sold (Tambora adds an 'All road' table for the other setup).
    let table = $('table.product-geometry__table').first();
    if (!table.length) {
      // 2019-21: a row of drawing letters (A B C ...) heads the table; drop it so the label row leads.
      table = $('table').filter((_, t) => $(t).find('.table-abjad').length > 0).first();
      table.find('tr').has('.table-abjad').remove();
    }
    if (!table.length) {
      // 2018: 'Sizes' leads the header, which labels the drop 'BB Height (BB Drop/Rise)' (labels.ts rejects BB heights).
      table = $('table').filter((_, t) => /^sizes?$/i.test($(t).find('tr').first().children().first().text().trim())).first();
      table.find('th').each((_, th) => {
        if (/bb drop/i.test($(th).text())) $(th).text('BB Drop');
      });
    }
    if (!table.length) return [];
    const sizes = geometryTables($.html(table))[0];
    if (!sizes) return [];
    // The title states a model year from 2024 on ('2026 HELIOS A0 AXS Road Bike | Polygon Bikes'), but copied pages keep
    // the old one (bend-r2-2019 reads 2022), so a year in the slug or path comes first.
    const year = p.year ?? (Number($('title').first().text().match(/^\s*(20\d\d)\s/)?.[1]) || undefined);
    return [{ model: p.model, year, category: p.category, sizes }];
  },
};
export default adapter;
