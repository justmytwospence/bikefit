import type { FrameCategory, GeometryKey } from '../../src/data/schema';
import type { Adapter, PartialSize } from '../types';

// Product pages: /en-us/bikes/road/<subcategory>/<platform>/<product>[/<model year>], since 2020.
// The 2018-2019 site (/en/USA/Bike/ProductDetail?Id=<guid>) and every page from model year 2022 on show geometry
// only as an image. Model years 2020-2021 load it from a JSON endpoint, /<locale>/api/products/<salsify id>,
// which the archive captured for some products: that endpoint is the only machine-readable source.
const URL_RE = /^https?:\/\/www\.cannondale\.com\/en-us\/bikes\/road\/(race|endurance|gravel|cyclocross)\/([a-z0-9-]+)\/([a-z0-9-]+)(\/20\d\d)?\/?(?:[?#].*)?$/;

// Platform slug (from the URL) to category, for the platforms whose endpoint ever carried geometry. The rest
// (caad-optimo, caad12, caad14, superx, caadx, supersix-evo-cx, supersix-evo-se, slate) only ever show an image:
// accepting them would cost discover thousands of requests for nothing, so they stay hand-entered overrides.
// Out of scope altogether: superslice (TT), synapse-carbon-flat-bar, topstone-neo-* and synapse-neo (e-bikes).
const PLATFORMS: Record<string, FrameCategory> = {
  'supersix-evo': 'race', caad13: 'race', systemsix: 'aero', synapse: 'endurance', 'synapse-carbon': 'endurance',
  'topstone-alloy': 'gravel', 'topstone-carbon': 'gravel',
};

// The same Salsify id is served under every locale (en, en-ca, en-gb and de-de were archived for a few more
// builds), but en-us alone covers every platform and generation found, at a fifth of the lookups.
const API_LOCALES = ['en-us'];

const LENGTHS: [string, GeometryKey][] = [
  ['Stack', 'stack'], ['Reach', 'reach'], ['HeadTubeLength', 'headTubeLength'], ['SeatTubeLength', 'seatTubeLength'],
  ['ChainstayLength', 'chainstay'], ['Wheelbase', 'wheelbase'], ['BottomBracketDrop', 'bbDrop'],
];
// Some products fill only the effective seat tube angle (SuperSix EVO 2021); it comes second, as a fallback.
const ANGLES: [string, GeometryKey][] = [
  ['SeatTubeAngle', 'seatTubeAngle'], ['SeatTubeAngleEffective', 'seatTubeAngle'], ['HeadTubeAngle', 'headTubeAngle'],
];

type Geo = Record<string, string | null>;
interface Variant { Size?: string; Geometry?: Geo | null }
interface Product {
  Platform?: string; Title?: string; Subtitle?: string; Category?: string; Subcategory?: string;
  ModelYear?: string; IsElectric?: boolean; Variants?: Variant[];
}

const num = (s: string | null | undefined) => {
  const m = String(s ?? '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

/** One size per label from the variants' geometry (centimetres, or inches when the stack is that small). */
function sizesOf(p: Product): PartialSize[] {
  const out = new Map<string, PartialSize>();
  for (const v of p.Variants ?? []) {
    const g = v.Geometry;
    const label = String(g?.Size || v.Size || '').trim();
    if (!g || !label || out.has(label)) continue;
    const stack = num(g.Stack);
    if (!(stack > 0)) continue;
    const scale = stack < 35 ? 25.4 : 10;
    const s: PartialSize = { size: label };
    for (const [k, key] of LENGTHS) {
      const x = num(g[k]);
      if (x > 0) s[key] = Math.round(x * scale);
    }
    for (const [k, key] of ANGLES) {
      const x = num(g[k]);
      if (x > 0 && s[key] === undefined) s[key] = Math.round(x * 10) / 10;
    }
    if (s.stack !== undefined && s.reach !== undefined) out.set(label, s);
  }
  return [...out.values()].sort((a, b) => a.stack! - b.stack!);
}

function productOf(json: string): Product | null {
  try {
    const d = JSON.parse(json) as { Data?: Product[] } | Product[];
    return (Array.isArray(d) ? d[0] : d.Data?.[0]) ?? null;
  } catch {
    return null;
  }
}

const adapter: Adapter = {
  brand: 'Cannondale',
  file: 'cannondale',
  prefixes: ['www.cannondale.com/en-us/bikes/road/'],
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    if (!m || !(m[2] in PLATFORMS) || /flat-bar|neo/.test(m[3])) return null;
    // Only some products' geometry endpoint was archived: one family per product page gives each its own chance.
    return { url: `https://www.cannondale.com/en-us/bikes/road/${m[1]}/${m[2]}/${m[3]}${m[4] ?? ''}`, family: `${m[2]}/${m[3]}${m[4] ?? ''}` };
  },
  related(html) {
    const id = html.match(/productSalsifyId\s*=\s*"([^"]+)"/)?.[1];
    return id ? API_LOCALES.map((l) => `https://www.cannondale.com/${l}/api/products/${encodeURIComponent(id)}`) : [];
  },
  extract(page) {
    const m = page.url.match(URL_RE);
    if (!m || !(m[2] in PLATFORMS)) return [];
    for (const json of Object.values(page.related)) {
      const p = productOf(json);
      if (!p || p.IsElectric || (p.Category && p.Category !== 'Road')) continue;
      const sizes = sizesOf(p);
      if (sizes.length < 2) continue;
      const womens = /women/i.test(`${p.Title} ${p.Subtitle}`);
      const model = `${p.Platform || p.Title}${womens ? " Women's" : ''}`.trim();
      const year = Number(p.ModelYear) || undefined;
      return [{ model, year, category: PLATFORMS[m[2]], sizes }];
    }
    return [];
  },
};
export default adapter;
