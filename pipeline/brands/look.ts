import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter, PartialSize } from '../types';

// Product pages of the us-en shop, 2019 on: /us-en/products/bikes/road-bikes/<aero|altitude|endurance>/[<series>/]<slug>,
// /bikes/gravel-bikes/gravel/<slug>, /gravel/gravel-bikes/<slug>, a broken-slash /bikes/gravel-bikes765-gravel-rs/<slug>
// and /blade-rs-2/<slug>. The 2017 to 2019 WordPress pages (/en/velo/) carry no geometry and are not read.
const URL_RE = new RegExp(
  '^https?://www\\.lookcycle\\.com(?::80)?/us-en/products/((?:bikes/road-bikes/(?:aero|altitude|endurance)'
  + '|bikes/gravel-bikes/gravel|bikes/gravel-bikes765-gravel-rs|gravel/gravel-bikes|blade-rs-2)'
  + '(?:/[a-z0-9-]+)?)/([a-z0-9-]+)/?(?:[?#].*)?$',
);

/** Frame families by slug, most specific first. Anything else (e-765, 796 Monoblade, Blade RS TT, track) is not read. */
const FAMILIES: [RegExp, string][] = [
  [/^795-blade-rs-3(?:-|$)/, '795-blade-rs-3'], [/^795-blade-rs(?:-|$)/, '795-blade-rs'], [/^795-blade(?:-|$)/, '795-blade'], [/^795-light-rs(?:-|$)/, '795-light-rs'],
  [/^785-huez-rs(?:-|$)/, '785-huez-rs'], [/^785-huez(?:-|$)/, '785-huez'], [/^765-optimum(?:-|$)/, '765-optimum'],
  [/^765-gravel-rs(?:-|$)/, '765-gravel-rs'], [/^765-gravel(?:-|$)/, '765-gravel'],
  [/^g85-cezal-rs(?:-|$)/, 'g85-cezal-rs'], [/^g85-cezal(?:-|$)/, 'g85-cezal'],
];
/** Series landing pages (no table) and the configurator. */
const NOT_PRODUCTS = /^(?:795-blade-rs(?:-3)?|785-huez(?:-rs)?|765-optimum|765-gravel(?:-rs)?|g85-cezal(?:-rs)?|795-light-rs|customize)$/;
const NOT_DROP_BAR = /(?:^|-)(?:e|tt|tri|triathlon|monoblade|madison|track|gotham|vitesse|kids?)(?:-|$)/;

/** Frames by the page's heading, most specific first; '+' and 'RS' run into the name on newer pages (795 BladeRS). */
const FRAMES: [RegExp, string][] = [
  [/\b795 blade ?rs ?3\b/, '795 Blade RS 3'], [/\b795 blade (?:rs ?2|2 rs)\b/, '795 Blade RS 2'], [/\b795 blade ?rs\b/, '795 Blade RS'],
  [/\b795 blade\b/, '795 Blade'], [/\b795 light ?rs\b/, '795 Light RS'],
  [/\b785 huez ?rs\b/, '785 Huez RS'], [/\b785 huez\b/, '785 Huez'],
  [/\b765 optimum ?(?:\+|plus)/, '765 Optimum Plus'], [/\b765 optimum\b/, '765 Optimum'],
  [/\b765 gravel ?rs\b/, '765 Gravel RS'], [/\b765 gravel\b/, '765 Gravel'],
  [/\bg85 cezal ?rs\b/, 'G85 Cezal RS'], [/\bg85 cezal\b/, 'G85 Cezal'],
];

/** Row labels as labels.ts names them; angle rows are marked (°). Front centre, trail, fork, top tube, HAV and standover go. */
function label(raw: string): string {
  const angle = raw.includes('°');
  const name = raw.replace(/\(.*?\)/g, '').replace(/^[A-Z]\d?\s*-\s*/, '').trim().toLowerCase();
  if (name === 'stack') return 'Stack';
  if (name === 'reach') return 'Reach';
  if (/^(?:head tube|tube de direction)$/.test(name)) return angle ? 'Head tube angle' : 'Head tube length';
  if (/^(?:seat tube|seat post|tube de selle)$/.test(name)) return angle ? 'Seat tube angle' : 'Seat tube length';
  if (/^(?:chainstays?|bases)$/.test(name)) return 'Chainstay length';
  return '';
}

/**
 * Pages name every Blade RS generation the same. The first (2020 to 2021, sold on into 2025) has a 75.8 degree seat
 * angle, and its rim and disc frames differ in chainstay (405 and 415 mm); later tables (74.5 degrees) are the
 * Blade RS 2, which the frame row calls '795 BLADE 2 RS'.
 */
function bladeRs(sizes: PartialSize[]): string {
  if (!sizes.some((s) => (s.seatTubeAngle ?? 0) >= 75.5)) return '795 Blade RS 2';
  return sizes.some((s) => (s.chainstay ?? 0) >= 410) ? '795 Blade RS Disc' : '795 Blade RS';
}

const adapter: Adapter = {
  brand: 'Look',
  file: 'look',
  // No trailing slash on bikes/gravel-bikes: it also covers the broken-slash bikes/gravel-bikes765-gravel-rs/ pages.
  prefixes: [
    'www.lookcycle.com/us-en/products/bikes/road-bikes/', 'www.lookcycle.com/us-en/products/bikes/gravel-bikes',
    'www.lookcycle.com/us-en/products/gravel/gravel-bikes/', 'www.lookcycle.com/us-en/products/blade-rs-2/',
  ],
  seeds: [],
  accept(url) {
    const m = url.match(URL_RE);
    if (!m) return null;
    const [, path, slug] = m;
    if (NOT_PRODUCTS.test(slug) || NOT_DROP_BAR.test(slug)) return null;
    // The Blade RS 2 collection (2026) lists builds whose slugs read 795-blade-rs-...
    let family = path === 'blade-rs-2' ? '795-blade-rs-2' : FAMILIES.find(([re]) => re.test(slug))?.[1];
    if (!family) return null;
    // Disc frames of 2020 to 2021 sold beside rim ones (Blade RS, Optimum) or beside the Optimum+: a family of their own,
    // so discovery keeps a page of each.
    if (/-disc(?:-|$)/.test(slug)) family += '-disc';
    return { url: `https://www.lookcycle.com/us-en/products/${path}/${slug}`, family };
  },
  extract(page) {
    const $ = cheerio.load(page.html);
    // The desktop table has every size; the phone copy repeats it as one small table per size.
    const table = $('table').filter((_, t) => $(t).find('thead').length > 0 && /\bStack\b/.test($(t).text())).first();
    if (!table.length) return [];
    table.find('tbody tr').each((_, tr) => {
      const head = $(tr).children('th,td').first();
      const name = label(head.text().replace(/\s+/g, ' ').trim());
      if (!name) return void $(tr).remove();
      head.text(name);
      // Decimal commas (71,75) sit beside points (525.2) in one table.
      $(tr).children('td').each((_, td) => void $(td).text($(td).text().replace(/(\d),(\d)/g, '$1.$2')));
    });
    const sizes = geometryTables($.html(table))[0];
    if (!sizes) return [];
    // '795 Blade<sup>RS</sup> 3 - Frameset': the superscript runs into the words around it.
    const h1 = $('h1').first().clone();
    h1.find('sup').each((_, s) => void $(s).replaceWith(` ${$(s).text()} `));
    const heading = h1.text().replace(/\s+/g, ' ').trim() || $('title').text().replace(/\s+/g, ' ').trim();
    const slug = page.url.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() ?? '';
    const text = heading.toLowerCase();
    if (/^e-|\be-765\b|\bmonoblade\b|\btt\b/.test(text)) return [];
    let model = FRAMES.find(([re]) => re.test(text))?.[1];
    if (!model) return [];
    if (model === '795 Blade RS' && /^795-blade-rs-3(?:-|$)/.test(slug)) model = '795 Blade RS 3';
    else if (model === '795 Blade RS' && /\/blade-rs-2\//.test(page.url)) model = '795 Blade RS 2';
    else if (model === '795 Blade RS') model = bladeRs(sizes);
    // The heading or slug states a model year now and then: 795 BLADE RS 2021 FRAMESET, 795-blade-rs-2023-frameset.
    const year = Number(heading.match(/\b(20[12]\d)\b/)?.[1] ?? slug.match(/(?:^|-)(20[12]\d)(?:-|$)/)?.[1]) || undefined;
    const category = categoryFrom(model, [[/blade/i, 'aero'], [/optimum/i, 'endurance'], [/gravel|cezal/i, 'gravel']], 'race');
    return [{ model, year, category, sizes }];
  },
};
export default adapter;
