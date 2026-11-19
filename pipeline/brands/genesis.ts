import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Only two eras of genesisbikes.co.uk keep their geometry in archived HTML:
//  - 2019 product pages, /bike/<slug>: one `#geo-table` with a hidden `<tr class="<size> geo-contents">` per size and
//    measurement (label in the th, millimetres in the td);
//  - 2018 fragments, /ajax-details.php?id=<slug>: the page's geometry tab, a plain table of sizes by numbered rows.
// From September 2020 the site is a client-rendered shell whose geometry comes from a search API, so it is not read here.

const HOST = String.raw`^https?:\/\/(?:www\.)?genesisbikes\.co\.uk(?::80)?`;
const PAGE_RE = new RegExp(`${HOST}\\/bike\\/([a-z0-9-]+)\\/?(?:[?#].*)?$`, 'i');
const FRAGMENT_RE = new RegExp(`${HOST}\\/ajax-details\\.php\\?(?:[^#]*&)?id=([a-z0-9-]+)(?:[&#].*)?$`, 'i');

/**
 * The drop-bar frames, matched on a name with its dashes as spaces ('croix de fer 30'): the first rule that matches
 * names the frame. Builds, framesets and colourways of one frame share a name, and where a family's frames differ
 * in geometry they are separate frames (Ti, Disc, the women's Delta, Zero SL, Vapour 30). Mountain bikes, flat-bar
 * and urban bikes, e-bikes and the touring Tour de Fer match nothing.
 */
const FRAMES: { re: RegExp; model: string; key: string }[] = [
  { re: /^croix de fer ti\b/, model: 'Croix de Fer Ti', key: 'croix-de-fer-ti' },
  { re: /^croix de fer\b/, model: 'Croix de Fer', key: 'croix-de-fer' },
  { re: /^cda\b/, model: 'CDA', key: 'cda' },
  { re: /^datum\b/, model: 'Datum', key: 'datum' },
  { re: /^delta\b.*\bw$/, model: 'Delta W', key: 'delta-w' },
  { re: /^delta\b/, model: 'Delta', key: 'delta' },
  { re: /^equilibrium disc\b/, model: 'Equilibrium Disc', key: 'equilibrium-disc' },
  { re: /^equilibrium\b/, model: 'Equilibrium', key: 'equilibrium' },
  { re: /^flyer\b/, model: 'Flyer', key: 'flyer' },
  { re: /^fugio\b/, model: 'Fugio', key: 'fugio' },
  { re: /^vagabond\b/, model: 'Vagabond', key: 'vagabond' },
  { re: /^vapour 30\b/, model: 'Vapour 30', key: 'vapour-30' },
  { re: /^vapour\b/, model: 'Vapour', key: 'vapour' },
  { re: /^volare\b/, model: 'Volare Disc', key: 'volare-disc' },
  { re: /^zero sl\b/, model: 'Zero SL', key: 'zero-sl' },
  { re: /^zero\b/, model: 'Zero', key: 'zero' },
];

const frameOf = (name: string) => {
  const n = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return /\bflat bar\b/.test(n) ? undefined : FRAMES.find((f) => f.re.test(n));
};

const adapter: Adapter = {
  brand: 'Genesis',
  file: 'genesis',
  // A bare '/bike/' prefix also matches the 12,000 filtered '/bikes?...' listings of the later site, so list the families.
  prefixes: [
    'www.genesisbikes.co.uk/bike/cda',
    'www.genesisbikes.co.uk/bike/croix-de-fer',
    'www.genesisbikes.co.uk/bike/datum',
    'www.genesisbikes.co.uk/bike/delta',
    'www.genesisbikes.co.uk/bike/equilibrium',
    'www.genesisbikes.co.uk/bike/flyer',
    'www.genesisbikes.co.uk/bike/fugio',
    'www.genesisbikes.co.uk/bike/vagabond',
    'www.genesisbikes.co.uk/bike/vapour',
    'www.genesisbikes.co.uk/bike/volare',
    'www.genesisbikes.co.uk/bike/zero',
    'www.genesisbikes.co.uk/ajax-details.php',
  ],
  seeds: [],
  accept(url) {
    const fragment = url.match(FRAGMENT_RE);
    const slug = (fragment ?? url.match(PAGE_RE))?.[1].toLowerCase();
    const frame = slug ? frameOf(slug) : undefined;
    if (!slug || !frame) return null;
    // The 2019 range also lists next year's bikes under '-2020' slugs, often with other geometry: keep them apart.
    const era = !fragment && /-202(?:0)?$/.test(slug) ? '-2020' : '';
    return {
      url: fragment ? `https://www.genesisbikes.co.uk/ajax-details.php?id=${slug}` : `https://www.genesisbikes.co.uk/bike/${slug}`,
      family: frame.key + era,
    };
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    const name = $('h1').first().text().trim() || (page.url.match(FRAGMENT_RE)?.[1] ?? '');
    const frame = frameOf(name);
    if (!frame) return [];
    const cell = (s: string) => s.replace(/\s+/g, ' ').trim();
    let table: string | undefined;
    const rows = $('#geo-table tr.geo-contents');
    if (rows.length) {
      // One two-cell row per size and measurement, the size being the row's first class: rebuild it as a table with
      // a column per size. A 0 marks a measurement the maker did not give.
      const sizes: string[] = [];
      const labels: string[] = [];
      const value = new Map<string, string>();
      rows.each((_, tr) => {
        const size = ($(tr).attr('class') ?? '').trim().split(/\s+/)[0].toUpperCase();
        const label = cell($(tr).find('th').text());
        const v = cell($(tr).find('td').attr('data-units') ?? $(tr).find('td').text());
        if (!size || !label) return;
        if (!sizes.includes(size)) sizes.push(size);
        if (!labels.includes(label)) labels.push(label);
        if (!/^0(?:\.0+)?$/.test(v)) value.set(`${label}\u0000${size}`, v);
      });
      table = `<table><tr><th>Size</th>${sizes.map((s) => `<th>${s}</th>`).join('')}</tr>${labels.map((l) =>
        `<tr><th>${l}</th>${sizes.map((s) => `<td>${value.get(`${l}\u0000${s}`) ?? ''}</td>`).join('')}</tr>`).join('')}</table>`;
    } else {
      // The 2018 fragment numbers its rows ('3. Reach') and misspells 'Chainstay'.
      $('table.ruled th').each((_, th) => {
        $(th).text(cell($(th).text()).replace(/^\d+\.\s*/, '').replace(/^chanstay/i, 'Chainstay'));
      });
      table = $.html($('table.ruled').filter((_, t) => /frame sizes/i.test($(t).find('th').first().text())).first());
    }
    const sizes = table ? geometryTables(table).sort((a, b) => b.length - a.length)[0] : undefined;
    if (!sizes) return [];
    // The pages state no model year; the build dates them by their capture.
    const category = categoryFrom(frame.model, [
      [/^(?:Croix de Fer|Fugio|Vagabond)/, 'gravel'], [/^(?:CDA|Vapour)/, 'cyclocross'], [/^(?:Volare|Zero)/, 'race'],
    ], 'endurance');
    return [{ model: frame.model, category, sizes }];
  },
};
export default adapter;
