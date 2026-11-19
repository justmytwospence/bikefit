import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// The Next.js shop (mid 2022 on) lists each frameset at /bike/frames/<slug>, and from late 2022 also at
// /product/<slug>, the same page. Only from March 2023 do its pages carry geometry rows; earlier ones, and the
// Magento site of 2018 to 2021, link a PDF and nothing else, so they are not looked for.
const URL_RE = /^https?:\/\/(?:www\.)?ritcheylogic\.com(?::80)?\/(bike\/frames|product)\/([a-z0-9-]+)\/?(?:[?#].*)?$/;
// The drop-bar framesets. Ultra, Ascent, P-29er, Timberwolf (MTB), Garden City (urban, track), Outback TandM
// (tandem), blem and demo listings, complete demo bikes and spare parts share the paths and are left out; so is
// outback-frameset-24, a page with no rows.
const SLUG = /^((?:break-away-)?(?:road-logic(?:-disc)?|outback)|montebello|septimer-break-away-carbon|swiss-cross(?:-disc|-canty)?)(-50th-anniversary)?-frameset(?:-my(20\d\d))?$/;

/** Each frameset sits under one of these words, on either path. */
const STEMS = ['road-logic', 'break-away-', 'outback', 'montebello', 'septimer', 'swiss-cross'];

interface TechnicalData {
  sizes?: { size?: string }[];
  rows?: { label?: string; values?: string[] }[];
}
interface Product { name?: string; slug?: string; technicalData?: TechnicalData | null }

function productOf($: cheerio.CheerioAPI): Product | null {
  try {
    const data = JSON.parse($('script#__NEXT_DATA__').first().text());
    return data?.props?.pageProps?.data?.product ?? null;
  } catch {
    return null;
  }
}

const adapter: Adapter = {
  brand: 'Ritchey',
  file: 'ritchey',
  prefixes: STEMS.flatMap((s) => [`ritcheylogic.com/bike/frames/${s}`, `ritcheylogic.com/product/${s}`]),
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    const s = m?.[2].match(SLUG);
    if (!m || !s) return null;
    // The 50th Anniversary editions are their frame in a new paint; the Outback's MY2023 page is its own era.
    const family = s[1] === 'swiss-cross' ? 'swiss-cross-disc' : s[1];
    return { url: `https://ritcheylogic.com/${m[1]}/${m[2]}`, family: s[3] ? `${family}@${s[3]}` : family };
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    const product = productOf($);
    const data = product?.technicalData;
    if (!data?.sizes?.length || !data.rows?.length) return [];
    // The geometry is JSON in __NEXT_DATA__ (product.technicalData: sizes, and rows of a label with one value per
    // size, '74.5°' or '593'); the page draws it as a grid of divs. Rebuild it as a table: 'Seat tube (c-t)' and
    // 'Head tube length ' read as labels.ts has them, and top tube, standover and fork rows are left out there.
    const table = $('<table></table>');
    const head = $('<tr></tr>').append($('<th></th>').text('Size'));
    for (const s of data.sizes) head.append($('<th></th>').text(s.size ?? ''));
    table.append(head);
    for (const r of data.rows) {
      const tr = $('<tr></tr>').append($('<th></th>').text(r.label ?? ''));
      for (const v of r.values ?? []) tr.append($('<td></td>').text(v));
      table.append(tr);
    }
    const sizes = geometryTables(`<html><body>${$.html(table)}</body></html>`)[0];
    if (!sizes) return [];
    // 'Road Logic Disc Frameset', 'Outback 50th Anniversary Frameset', 'Outback frameset MY2023', 'Outback frameset
    // 23/24', 'Septimer Break-Away Carbon Frameset'. familyName would drop the Disc that tells two Road Logics apart.
    const name = (product?.name ?? $('h1').first().text()).replace(/\s+/g, ' ').trim();
    const model = name.replace(/\s+frame(?:set)?\b.*$/i, '').replace(/\s+50th anniversary\b/i, '').replace(/\s+carbon$/i, '').trim();
    if (!model) return [];
    // Only the page of an earlier Outback names a model year: 'MY2023', later '23/24'.
    const stated = name.match(/\bMY\s?(20\d\d)\b/i)?.[1] ?? name.match(/\b(\d\d)\/\d\d\b/)?.[1]?.replace(/^/, '20');
    const year = Number(stated) || undefined;
    const category = categoryFrom(`${product?.slug ?? ''} ${page.url}`, [
      [/montebello/, 'endurance'], [/outback|septimer/, 'gravel'], [/swiss-cross/, 'cyclocross'],
    ], 'race');
    return [{ model, year, category, sizes }];
  },
};
export default adapter;
