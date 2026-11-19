import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter, PartialSize } from '../types';

// Product pages: /<slug>[-d41|-d42|-r142|-<product id>], also filed under /bikes/road-gravel-bikes/[adventure-gravel/]
// and /2018-century-arden/. The slug is the line (Haanjo, Haanjenn women's, Century, Arden women's), the build number
// with C for carbon (haanjo-7c-carbon, century4carbon, arden-5c), EXP, then a template or product id (d41 = model year
// 2018, d42 = 2019, 44xx-46xx = 2020 to 2023, 50xx = 2024 to 2025). Shoes, pedals and tyres share the line names
// (century-elite-road-cycling-shoe) and do not fit it. Since mid 2025 the shop (/products/haanjo-5) carries no geometry.
const URL_RE = new RegExp(
  '^https?://(?:www\\.)?diamondback\\.com(?::80)?/'
  + '((?:bikes/road-gravel-bikes/(?:adventure-gravel/)?|2018-century-arden/)?)'
  + '((?:haanjo|haanjenn|century|arden)(?:-?\\d{1,2}c?)?(?:-exp)?(?:-?carbon)?(?:-(?:d4\\d|r1\\d\\d|\\d{4,6}))?)'
  + '/?(?:[?#].*)?$',
);

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The handlebar the build specifies: 'HED Tour Flat Top Drop Bar', 'DB Flat Bar, 640mm Wide'. */
function handlebar($: cheerio.CheerioAPI): string {
  let bar = '';
  // Before 2020: <th class="label">Handlebar</th><td class="data">; after: <span class="specification-label">
  // <strong>Handlebar</strong></span><span class="specification-value"> (labelled 'Bike Handlebar' in 2020).
  $('th.label, .specification-label').each((_, el) => {
    if (!bar && /^(?:bike\s+)?handlebar$/i.test(clean($(el).text()))) bar = clean($(el).next().text());
  });
  return bar;
}

/**
 * The size a header cell names: its frame size in cm when it states one ('XS/50cm Height: 5'0" - 5'4"', 'SM/50 5'4"-5'8"',
 * '47CM', '48'), else its letter ('XS', 'SM'). The rider heights that follow are dropped.
 */
function sizeLabel(cell: string): string {
  const token = clean(cell).split(' ')[0] ?? '';
  return token.match(/\d{2}/)?.[0] ?? token.replace(/\/+$/, '').toUpperCase();
}

/** The model a product name belongs to: carbon builds share one frame per line, alloy builds keep their number. */
function modelOf(name: string): string | null {
  const m = name.match(/\b(haanjo|haanjenn|century|arden)\b\s*(\d{1,2})?(c\b)?(.*)$/i);
  if (!m) return null;
  const line = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  if (m[3] || /\bcarbon\b/i.test(m[4])) return `${line} Carbon`;
  if (!m[2]) return line;
  return `${line} ${m[2]}${/\bexp\b/i.test(m[4]) ? ' EXP' : ''}`;
}

/** Some 2020 captures list a size twice, by letter and by letter and cm ('MD', 'MD/53cm'): keep the cm one. */
function dedupe(sizes: PartialSize[]): PartialSize[] {
  const sig = (s: PartialSize) => `${s.stack}/${s.reach}/${s.seatTubeAngle}/${s.headTubeAngle}/${s.wheelbase}`;
  const numbered = new Set(sizes.filter((s) => /^\d+$/.test(s.size)).map(sig));
  return sizes.filter((s) => /^\d+$/.test(s.size) || !numbered.has(sig(s)));
}

const adapter: Adapter = {
  brand: 'Diamondback',
  file: 'diamondback',
  prefixes: ['www.diamondback.com/haanjo', 'www.diamondback.com/haanjenn', 'www.diamondback.com/century', 'www.diamondback.com/arden'],
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    // Haanjo 1 and Haanjenn 1 have flat bars in every year (2018 to 2023); extract() checks other builds' handlebars.
    if (!m || /^haanj(?:o|enn)-1-/.test(m[2])) return null;
    // One family per product (slug with its id): Diamondback reuses build numbers across frames, so builds stay apart.
    return { url: `https://www.diamondback.com/${m[1]}${m[2]}`, family: m[2] };
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    // Haanjo 1 and Haanjenn 1 are flat-bar builds of the gravel frame. The table's 'Handlebar Width' row cannot tell:
    // the 2021 to 2023 Haanjo 2 and 3 pages list 640 mm under a drop bar.
    const bar = handlebar($);
    if (/flat bar|riser/i.test(bar) && !/drop/i.test(bar)) return [];
    // Before 2020 the table sits in the 'Sizes' tab (#bike_sizes), later in .geometry-table-wrapper. Rows are
    // measurements; labels from 2020 on start with 'Bike ' ('Bike Stack', 'Bike Head Angle'), which keyFor does not know.
    const table = $('#bike_sizes table, .geometry-table-wrapper table').first();
    if (!table.length) return [];
    table.find('th').each((_, th) => void $(th).text(clean($(th).text()).replace(/^Bike\s+/i, '')));
    table.find('tr').first().children('td').each((_, td) => void $(td).text(sizeLabel($(td).text())));
    const tables = geometryTables($.html(table));
    if (!tables.length) return [];
    // The heading names the build ('Haanjo 7C Carbon', 'Arden 4 Carbon (2018)'); the title as a fallback
    // ('Buy Haanjo 3 Adventure & Gravel Bike | Diamondback', 'Diamondback 2017 Century 2').
    const title = clean($('title').first().text());
    const h1 = clean($('h1').first().text());
    const name = h1 || title.split(/\s[|-]\s/)[0];
    const model = modelOf(name.replace(/\(\d{4}\)/, ''));
    if (!model) return [];
    // Pages of 2018 bikes state the model year in the heading (Haanjo 7C Carbon (2018)) or title (Diamondback 2017 Century 2).
    const year = Number(h1.match(/\((20\d\d)\)/)?.[1] ?? title.match(/^Diamondback (20\d\d)\b/)?.[1]) || undefined;
    const category = categoryFrom(model, [[/haanj/i, 'gravel']], 'endurance');
    return [{ model, year, category, sizes: dedupe(tables[0]) }];
  },
};
export default adapter;
