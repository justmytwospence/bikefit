import { categoryFrom } from '../lib/category';
import { familyName, geometryTables, jsonLdSizes } from '../lib/extract';
import type { Adapter } from '../types';

/** Canyon build names that are not part of the frame family. */
const CANYON_WORDS = ['rs', 'speed', 'raw', 'atr', 'ltd', 'sl8', 'trail'];

const adapter: Adapter = {
  brand: 'Canyon',
  file: 'canyon',
  prefixes: ['www.canyon.com/en-us/road-bikes/', 'www.canyon.com/en-us/gravel-bikes/'],
  seeds: [],
  accept(url) {
    const m = url.match(/^https?:\/\/www\.canyon\.com\/en-us\/((?:road|gravel)-bikes\/[a-z0-9\-/]+)\/\d{4,5}\.html/);
    if (!m || /electric|(^|\/)e-bikes?|triathlon|time-trial|speedmax|-on-|neuron/.test(m[1])) return null;
    const parts = m[1].split('/');
    if (parts.length < 4) return null;
    return { url: url.replace(/[?#].*$/, '').replace(/^http:/, 'https:'), family: parts.slice(0, -1).join('/') };
  },
  /** 2022-2025 pages load the geometry table from this endpoint instead of carrying it. */
  related(html) {
    const pid = html.match(/Product-IncludeGeometry\?pid=(\d+)/)?.[1];
    return pid ? [`https://www.canyon.com/on/demandware.store/Sites-US-Site/en_US/Product-IncludeGeometry?pid=${pid}`] : [];
  },
  extract(page) {
    // Current pages carry schema.org product data; pages captured before about 2026 only have the
    // geometry table, with "Your selected size" in each size header.
    let sizes = jsonLdSizes(page.html);
    if (sizes.length < 2) {
      const table = [page.html, ...Object.values(page.related)].map((h) => geometryTables(h)[0]).find(Boolean) ?? [];
      sizes = table.map((s) => ({ ...s, size: s.size.replace(/\s*Your selected size\s*/i, '').trim() }));
    }
    if (sizes.length < 2) return [];
    const name = page.html.match(/"@type":\s*"ProductGroup".*?"name":\s*"([^"]+)"/s)?.[1]
      ?? page.html.match(/<title>\s*([^<|]+?)\s*(?:\||<)/)?.[1];
    if (!name) return [];
    // Build suffixes (RS, SPEED, RAW, ATR) go with the build words; shouting names (GRIZL) get title case.
    const words = name.replace(/\s+WMN\b/i, '').split(' ').map((w) => (/^[A-Z]{4,}$/.test(w) && !/^(?:SLX|CFR)$/.test(w) ? w[0] + w.slice(1).toLowerCase() : w));
    const model = familyName(words.join(' '), CANYON_WORDS);
    const path = page.url;
    const category = categoryFrom(path, [
      [/cyclocross/, 'cyclocross'], [/gravel-bikes/, 'gravel'], [/aero/, 'aero'], [/endurance/, 'endurance'],
    ], 'race');
    return [{ model, category, sizes }];
  },
};
export default adapter;
