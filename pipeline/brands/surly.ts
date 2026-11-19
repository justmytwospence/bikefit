import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter, PartialSize } from '../types';

// Surly has two sites worth reading. The old one (/bikes/<model>, 2018 to early 2025) loads its geometry table into the page
// from the middle of 2019 on (pages before April 2019 fetched it from a URL that the archive does not hold, so they give
// nothing); the Shopify shop (/products/<handle>, from April 2025) renders a plain <table id="geoTable">. Both give millimetres.
//
// Drop-bar frames only: Midnight Special, Straggler, Preamble, Grappler, Cross-Check, Pacer, Bridge Club and the touring
// bikes (Disc Trucker, Long Haul Trucker, Travel Check). There is no touring category, so those are gravel. Steamroller
// (single speed), the flat-bar Preamble builds and the fat, MTB and cargo bikes are not accepted.

interface Family { key: string; name: string; wheels?: boolean }
const FAMILIES: Family[] = [
  { key: 'midnight-special', name: 'Midnight Special' },
  { key: 'straggler', name: 'Straggler', wheels: true },
  { key: 'preamble', name: 'Preamble' },
  { key: 'grappler', name: 'Grappler' },
  { key: 'disc-trucker', name: 'Disc Trucker', wheels: true },
  { key: 'long-haul-trucker', name: 'Long Haul Trucker', wheels: true },
  { key: 'bridge-club', name: 'Bridge Club' },
  { key: 'cross-check', name: 'Cross-Check' },
  { key: 'pacer', name: 'Pacer' },
  { key: 'travel-check', name: 'Travel Check' },
];
const byKey = new Map(FAMILIES.map((f) => [f.key, f]));
/** The Ghost Grappler is a special edition of the Grappler frame. */
const ALIAS: Record<string, string> = { 'ghost-grappler': 'grappler' };
const MODELS = '(midnight_special|cross_check|disc_trucker|long_haul_trucker|pacer|preamble|straggler|grappler|ghost_grappler|bridge_club|travel_check)';
const FIRST_YEAR = 2018;

const HOST = '^https?://(?:www\\.)?surlybikes\\.com(?::\\d+)?';
const OLD_RE = new RegExp(`${HOST}/bikes/(?:(legacy|_bike_info|_geometry)/)?([a-z0-9_]+)/?(?:[?#].*)?$`);
const SHOP_RE = new RegExp(`${HOST}/products/([a-z0-9_-]+)/?(?:[?#].*)?$`);
const OLD_SLUG = new RegExp(`^${MODELS}(?:_(20\\d\\d))?$`);
/** Pages of the retired Straggler colours (/bikes/legacy/straggler_mint, straggler_650b_purple). */
const STRAGGLER_COLOUR = /^straggler(?:_650b)?_(?:mint|purple)$/;
const SHOP_OLD = new RegExp(`^${MODELS}_(\\d{4})$`);
const SHOP_NEW = /^(midnight-special|straggler|preamble|grappler|ghost-grappler|disc-trucker|bridge-club|long-haul-trucker|cross-check|pacer|travel-check)(?:-([a-z0-9-]+))?$/;
/** Parts, clothing and builds that are not drop-bar frames, in the rest of a shop handle after the family. */
const SHOP_REJECT = /(?:^|-)(?:decal|fork|screws?|bolts?|rack|bag|sticker|shirt|socks?|hat|bottle|flat-bar|dropout|spacer|stem|thru|axle|copy)(?:-|$)/;

const WHEEL = /(?:^|[\s_-])(26|650b|700c)(?=$|["\s_-])/i;
const wheelOf = (text: string): string => {
  const w = text.match(WHEEL)?.[1].toLowerCase();
  return w === '26' ? '26in' : w ?? '';
};

interface Hit { family: Family; /** The wheel size the URL names ('', '26in', '650b' or '700c'). */ wheel: string; url: string }

function classify(url: string): Hit | null {
  const old = url.match(OLD_RE);
  if (old) {
    const [, dir, slug] = old;
    let key: string | undefined;
    if (dir === 'legacy' && STRAGGLER_COLOUR.test(slug)) key = 'straggler';
    else {
      const m = slug.match(OLD_SLUG);
      // The year in a slug is the frame's generation: a page of a generation older than the catalog is not wanted.
      if (!m || (m[2] && (dir !== 'legacy' || Number(m[2]) < FIRST_YEAR))) return null;
      key = m[1].replace(/_/g, '-');
    }
    const family = byKey.get(ALIAS[key] ?? key);
    if (!family) return null;
    return { family, wheel: wheelOf(slug), url: `https://surlybikes.com/bikes/${dir ? `${dir}/` : ''}${slug}` };
  }
  const shop = url.match(SHOP_RE);
  if (!shop) return null;
  const handle = shop[1];
  const archived = handle.match(SHOP_OLD);
  if (archived) {
    if (Number(archived[2]) < FIRST_YEAR) return null;
    const key = archived[1].replace(/_/g, '-');
    const family = byKey.get(ALIAS[key] ?? key);
    return family ? { family, wheel: '', url: `https://surlybikes.com/products/${handle}` } : null;
  }
  const m = handle.match(SHOP_NEW);
  if (!m || (m[2] && SHOP_REJECT.test(m[2]))) return null;
  const family = byKey.get(ALIAS[m[1]] ?? m[1]);
  return family ? { family, wheel: wheelOf(m[2] ?? ''), url: `https://surlybikes.com/products/${handle}` } : null;
}

/** The old site's size labels differ from the shop's for the same bikes: spell them the shop's way so pages of one frame merge. */
const SIZES: Record<string, string> = { xs: 'X-Small', sm: 'Small', md: 'Medium', lg: 'Large', xl: 'X-Large', xxl: 'XX-Large' };

/** Drawing letters ('G. Headtube Angle') go; two words labels.ts reads as the head tube length or does not know are respelled. */
function label(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/^[A-Z]\.\s+/, '')
    .replace(/^headtube angle/i, 'Head Tube Angle')
    .replace(/^total seat tube length/i, 'Seat Tube Length');
}

/** Tab panels are named geo-<variant>-<n>: a wheel size ('26', '700c'), a bar ('flat-bar'), a fork or a gearing. */
function variantOf(id: string | undefined): string {
  return id?.match(/^geo-(.*?)-?\d+$/)?.[1] ?? '';
}

const adapter: Adapter = {
  brand: 'Surly',
  file: 'surly',
  // Family names only: the shop sells decals, parts and every other bike under /products/, and /bikes/ holds the MTBs.
  prefixes: [
    ...['midnight', 'straggler', 'preamble', 'grappler', 'ghost', 'disc', 'bridge', 'long', 'cross', 'pacer'].map((p) => `surlybikes.com/bikes/${p}`),
    'surlybikes.com/bikes/legacy/', 'surlybikes.com/bikes/_bike_info/', 'surlybikes.com/bikes/_geometry/',
    ...['midnight', 'straggler', 'preamble', 'grappler', 'ghost', 'disc', 'bridge', 'long', 'cross', 'pacer', 'travel'].map((p) => `surlybikes.com/products/${p}`),
  ],
  seeds: [],
  accept(url) {
    const hit = classify(url);
    if (!hit) return null;
    // A shop handle names one wheel size and shows that size's table: keep each wheel size a family of its own, so a
    // period's few tries are not all spent on one of them.
    const shop = hit.url.includes('/products/');
    return { url: hit.url, family: shop && hit.family.wheels && hit.wheel ? `${hit.family.key}-${hit.wheel}` : hit.family.key };
  },
  extract(page) {
    const hit = classify(page.url);
    if (!hit) return [];
    const $ = cheerio.load(page.html);
    // Cells hold an inch and a millimetre value (<i data-unit="in">22.8</i><i data-unit="mm">580</i>): keep the millimetres.
    $('i[data-unit="in"]').remove();
    const tables = $('table.chart-sizes-target, table#geoTable').toArray();
    // A shop handle for one wheel size ('Disc Trucker 26" - Grandpa's Khakis') has one table: its wheel size is the page's.
    const pageWheel = hit.wheel || wheelOf($('h1').first().text());
    const byModel = new Map<string, PartialSize[]>();
    for (const t of tables) {
      const table = $(t);
      const variant = variantOf(table.closest('[id^="geo-"]').attr('id'));
      // Flat-bar and single-speed builds have their own tables.
      if (/flat|single|^ss/.test(variant)) continue;
      table.find('tr').each((_, tr) => {
        const [first] = $(tr).children('td,th').toArray();
        if (first) $(first).text(label($(first).text()));
      });
      // Sizes read '56cm(700c)' where the wheel size is the table's.
      table.find('th[data-size], thead th').each((_, th) => {
        $(th).text($(th).text().replace(/\s*\((?:26|650b|700c)\)/i, '').replace(/\s+/g, ' ').trim());
      });
      const sizes = geometryTables($.html(table))[0];
      if (!sizes) continue;
      for (const s of sizes) s.size = SIZES[s.size.toLowerCase()] ?? s.size;
      // Retired bikes on the shop (Long Haul Trucker) lead each table with an <h4>26"</h4> or <h4>700c</h4>.
      const wheel = wheelOf(variant) || wheelOf(table.prevAll('h4').first().text()) || (tables.length === 1 ? pageWheel : '');
      const model = hit.family.name + (hit.family.wheels && wheel ? ` ${wheel}` : '');
      if (!byModel.has(model)) byModel.set(model, sizes);
    }
    // Retired pages with the same label for different frames would otherwise drop the model: one table per name.
    return [...byModel].map(([model, sizes]) => ({
      model,
      category: categoryFrom(model, [[/^cross-check/i, 'cyclocross'], [/^(?:midnight special|preamble|pacer)/i, 'endurance']], 'gravel'),
      sizes,
    }));
  },
};
export default adapter;
