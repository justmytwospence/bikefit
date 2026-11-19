import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter, PartialSize } from '../types';

// Felt's site has had four templates. Only two carry geometry as text:
//   2018 (ASP.NET): /usa/2016/bikes/<road|cross>/...aspx, a <table> in #divBikeGeometry, millimetres and degrees.
//   2023 to 2026 (AEM): /en-us/bikes/<category>/<group>/<build>.html, the geometry in a data-bikedata JSON attribute.
// The Shopify store of 2019 to 2022 and of 2026 shows the geometry as an image only, so it is not accepted.

const HOST = 'https://www.feltbicycles.com';

/** The 2018 site's leaf pages: the bike's folder, then its slug. Mountain, fitness, cruiser, electric, triathlon and kids bikes live elsewhere. */
const OLD_URL = /^https?:\/\/(?:www\.)?feltbicycles\.com(?::80)?\/usa\/2016\/bikes\/(road\/race\/frw?|road\/aero|road\/endurance\/vrw?|cross\/fx-16)\/([a-z0-9-]+)\.aspx(?:[?#].*)?$/i;

/**
 * Frames of the 2018 site, one family each: the tables of a frame's bikes agree. 'Previous bikes' (Living-Line-Previous-Bikes)
 * are model years 2017 and older and are not accepted.
 */
function legacy(folder: string, slug: string): { model: string; category: FrameCategory; family: string } | null {
  // Frame kits and framesets repeat a bike's page, some without the table.
  if (/frame-?kit|frameset/.test(slug)) return null;
  let m: RegExpMatchArray | null;
  if (folder === 'road/aero') {
    m = slug.match(/^ar\d(?=-|$)/);
    return m && { model: 'AR', category: 'aero', family: 'ar' };
  }
  if (folder.startsWith('road/race/')) {
    // FR1 to FR6 are one carbon frame; FR30, FR40 and FR60 (a zero after the digit) are the aluminium one. A trailing W is the women's bike.
    m = slug.match(/^fr\d(0?)(w?)(?=-|$)/);
    return m && { model: m[1] ? 'FR Alloy' : 'FR', category: 'race', family: `fr${m[1] ? '-alloy' : ''}${m[2] ? '-w' : ''}` };
  }
  if (folder.startsWith('road/endurance/')) {
    m = slug.match(/^vr\d(0?)(w?)(?=-|$)/);
    return m && { model: m[1] ? 'VR Alloy' : 'VR', category: 'endurance', family: `vr${m[1] ? '-alloy' : ''}${m[2] ? '-w' : ''}` };
  }
  return /^f\d+x(?=-|$)/.test(slug) ? { model: 'FX', category: 'cyclocross', family: 'fx' } : null;
}

/** The 2023 to 2026 site: model groups of road, gravel and cyclocross bikes (Verza flat-bar, triathlon, track and mountain bikes are elsewhere). */
const GROUPS = 'ar-aero-road|fr-road-race|vr-endurance-road|breed-carbon|breed-gravel|broam-adventure|fx-cyclocross-race';
// Live pages sit under /bikes/; models of earlier years under /archive/<model year>/. A '.color.<hex>' suffix is the same page in another colour.
const NEW_URL = new RegExp(
  `^https?://www\\.feltbicycles\\.com/en-us/(?:archive/(\\d{4})/|bikes/)(road-bikes|gravel-adventurebikes|cyclocross-bikes)/(${GROUPS})/([a-z0-9%+-]+?)(?:\\.color\\.[^/]*?)?\\.html(?:[?#].*)?$`,
  'i',
);

/** One family per build tier ('fr-advanced', 'fr-advanced-plus', 'fr-30'), so discovery tries each tier's page: builds of a frame can differ in geometry. */
function tierOf(leaf: string): string {
  const t = decodeURIComponent(leaf).split('-');
  if (t.length < 2) return '';
  return t[2] === '+' ? `${t[0]}-${t[1]}-plus` : `${t[0]}-${t[1]}`;
}

const adapter: Adapter = {
  brand: 'Felt',
  file: 'felt',
  prefixes: [
    'www.feltbicycles.com/usa/2016/bikes/road/',
    'www.feltbicycles.com/usa/2016/bikes/cross/fx-16/',
    'www.feltbicycles.com/en-us/bikes/road-bikes/',
    'www.feltbicycles.com/en-us/bikes/gravel-adventurebikes/',
    'www.feltbicycles.com/en-us/bikes/cyclocross-bikes/',
    'www.feltbicycles.com/en-us/archive/',
  ],
  seeds: [],
  accept(url) {
    const o = url.match(OLD_URL);
    if (o) {
      const line = legacy(o[1].toLowerCase(), o[2].toLowerCase());
      if (!line) return null;
      return { url: `${HOST}/usa/2016/bikes/${o[1]}/${o[2]}.aspx`.toLowerCase(), family: line.family };
    }
    const n = url.match(NEW_URL);
    if (!n) return null;
    const [, year, category, group, leaf] = n;
    const path = (year ? `archive/${year}/` : 'bikes/') + `${category}/${group}/${leaf.replace(/\+/g, '%2b')}`;
    const tier = tierOf(leaf.toLowerCase());
    return { url: `${HOST}/en-us/${path}.html`.toLowerCase(), family: `${tier || group.toLowerCase()}${year ? `-${year}` : ''}` };
  },
  extract(page) {
    if (OLD_URL.test(page.url)) return extractOld(page.url, page.html);
    const year = Number(page.url.match(/\/archive\/(\d{4})\//)?.[1]) || undefined;
    return extractNew(page.html, year);
  },
};

/** Stack must grow with size: the 2018 FR2 page repeats the 47's stack for the 51 (and F30x has a chainstay of 130). Drop a size that breaks the order. */
function growing(sizes: PartialSize[]): PartialSize[] {
  const out: PartialSize[] = [];
  for (const s of sizes) {
    const p = out[out.length - 1];
    if (!p || s.stack! > p.stack!) out.push(s);
  }
  return out;
}

function extractOld(url: string, html: string) {
  const m = url.match(OLD_URL);
  const line = m && legacy(m[1].toLowerCase(), m[2].toLowerCase());
  if (!line) return [];
  const $ = cheerio.load(html);
  const table = $('#divBikeGeometry table').first();
  if (!table.length) return [];
  // Both 'Center to Center' rows (top and seat tube) are dashes on most bikes, and would otherwise claim the seat tube length.
  table.find('tr').each((_, tr) => {
    if (/center to center/i.test($(tr).children().first().text())) $(tr).remove();
  });
  const sizes = growing(geometryTables($.html(table))[0] ?? []);
  // The page does not state a model year: the build dates it from the capture.
  return sizes.length >= 2 ? [{ model: line.model, category: line.category, sizes }] : [];
}

/** BC_GEO_* keys of the data-bikedata JSON, as labels labels.ts accepts. */
const NEW_LABELS: Record<string, string> = {
  BC_GEO_STACK_MIN: 'Stack',
  BC_GEO_REACH_MIN: 'Reach',
  BC_GEO_SEAT_ANGLE: 'Seat Tube Angle',
  BC_GEO_STEER_ANGLE_MIN: 'Head Tube Angle',
  BC_GEO_HEAD_TUBE_MIN: 'Head Tube Length',
  BC_GEO_SEAT_TUBE_LEN: 'Seat Tube Length',
  BC_GEO_CHAIN_STAY_MIN: 'Chainstay Length',
  BC_GEO_WHEEL_BASE_MIN: 'Wheelbase',
  BC_GEO_BB_DROP: 'BB Drop',
};

interface BikeData {
  displayname?: string;
  variants?: { size?: { value?: string }; geometries?: { key?: string; value?: string }[] }[];
}

function extractNew(html: string, year: number | undefined) {
  const $ = cheerio.load(html);
  let data: BikeData;
  try {
    data = JSON.parse($('[data-bikedata]').first().attr('data-bikedata') ?? '');
  } catch {
    return [];
  }
  // 'VR | RACE | 105': the line, the tier, the groupset. 'AR FRD | Ultimate | ...' is still the AR frame.
  const [name, tier = ''] = (data.displayname ?? '').split('|').map((s) => s.trim());
  const line = (name ?? '').split(' ')[0].toUpperCase();
  if (!/^(AR|FR|VR|FX|BREED|BROAM)$/.test(line)) return [];
  // A numbered tier (FR 30, VR 40, BREED 20) is the aluminium frame of the line; all BROAM bikes are aluminium.
  const model = (line.length <= 2 ? line : line[0] + line.slice(1).toLowerCase()) + (/^\d+$/.test(tier) && line !== 'BROAM' ? ' Alloy' : '');
  const category = categoryFrom(line, [[/^AR$/, 'aero'], [/^VR$/, 'endurance'], [/^(BREED|BROAM)$/, 'gravel'], [/^FX$/, 'cyclocross']], 'race');
  // One column per size (each colour repeats them), one row per measurement.
  const bySize = new Map<string, Record<string, string>>();
  for (const v of data.variants ?? []) {
    const size = v.size?.value;
    if (!size || bySize.has(size)) continue;
    bySize.set(size, Object.fromEntries((v.geometries ?? []).map((g) => [g.key ?? '', g.value ?? ''])));
  }
  const sizes = [...bySize.keys()];
  const rows = Object.entries(NEW_LABELS).map(([key, label]) =>
    `<tr><th>${label}</th>${sizes.map((s) => `<td>${bySize.get(s)![key] ?? ''}</td>`).join('')}</tr>`);
  const table = `<table><tr><th></th>${sizes.map((s) => `<th>${s}</th>`).join('')}</tr>${rows.join('')}</table>`;
  const found = geometryTables(table)[0];
  return found ? [{ model, year, category, sizes: found }] : [];
}

export default adapter;
