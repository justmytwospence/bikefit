import { categoryFrom } from '../lib/category';
import { familyName, jsonLdSizes } from '../lib/extract';
import type { Adapter } from '../types';

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
  extract(page) {
    const sizes = jsonLdSizes(page.html);
    if (sizes.length < 2) return [];
    const name = page.html.match(/"@type":\s*"ProductGroup".*?"name":\s*"([^"]+)"/s)?.[1];
    if (!name) return [];
    const model = familyName(name.replace(/\s+WMN\b/i, ''));
    const path = page.url;
    const category = categoryFrom(path, [
      [/gravel-bikes/, 'gravel'], [/cyclocross/, 'cyclocross'], [/aero/, 'aero'], [/endurance/, 'endurance'],
    ], 'race');
    return [{ model, category, sizes }];
  },
};
export default adapter;
