import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Product pages /en/bike/<id>/<slug> carry an HTML geometry table whose labels lead with an abbreviation
// ('STA seat tube angle [°]'). Archive pages are skipped: they are captured years after their model year.
const LINE = /^(scultura-endurance-gr|scultura-endurance|scultura-rim|scultura|reacto|silex|mission-road|mission-cx|mission|cyclo-cross|ride)(?:-|$)/;
const SKIP = /track|mission-j-|frame-?kit-only|tri|time-warp/;

const MODELS: [RegExp, string, FrameCategory][] = [
  [/^SCULTURA ENDURANCE GR\b/, 'Scultura Endurance GR', 'endurance'],
  [/^SCULTURA ENDURANCE\b/, 'Scultura Endurance', 'endurance'],
  [/^SCULTURA RIM\b/, 'Scultura Rim', 'race'],
  [/^SCULTURA\b/, 'Scultura', 'race'],
  [/^REACTO\b/, 'Reacto', 'aero'],
  [/^SILEX\b/, 'Silex', 'gravel'],
  [/^MISSION ROAD\b/, 'Mission Road', 'gravel'],
  [/^MISSION\b/, 'Mission CX', 'cyclocross'],
  [/^CYCLO ?CROSS\b/, 'Cyclo Cross', 'cyclocross'],
  [/^RIDE\b/, 'Ride', 'endurance'],
];

/** Pages stay up for years; their product photos ('..._MY2022.tif') name the model year they show. */
function modelYear(html: string): number | undefined {
  const n = new Map<number, number>();
  for (const m of html.matchAll(/_MY(20\d\d)\./g)) n.set(Number(m[1]), (n.get(Number(m[1])) ?? 0) + 1);
  const years = [...n].filter(([, c]) => c >= 5).map(([y]) => y);
  return years.length ? Math.max(...years) : undefined;
}

const adapter: Adapter = {
  brand: 'Merida',
  file: 'merida',
  prefixes: ['www.merida-bikes.com/en/bike/'],
  seeds: [],
  accept(url) {
    const m = url.replace(/[?#].*$/, '').match(/^https?:\/\/www\.merida-bikes\.com\/en\/bike\/(\d+)\/([a-z0-9-]+)$/);
    if (!m) return null;
    const line = m[2].match(LINE)?.[1];
    if (!line || SKIP.test(m[2])) return null;
    return { url: `https://www.merida-bikes.com/en/bike/${m[1]}/${m[2]}`, family: line === 'mission' ? 'mission-cx' : line };
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    $('table.geometry-table td:first-child').each((_, c) => {
      $(c).text($(c).text().trim().replace(/^[A-Z]{1,4}\s+(?=[a-z])/, '').replace('bracked', 'bracket'));
    });
    const tables = geometryTables($.html());
    if (!tables.length) return [];
    const title = $('h1').first().text().replace(/\s+/g, ' ').trim().toUpperCase().replace(/^MERIDA\s+/, '');
    if (/^E-?(SCULTURA|SILEX|ONE)|TRACK|TIME WARP/.test(title)) return [];
    const hit = MODELS.find(([re]) => re.test(title));
    if (!hit) return [];
    return [{ model: hit[1], category: hit[2], year: modelYear(page.html), sizes: tables[0] }];
  },
};
export default adapter;
