import * as cheerio from 'cheerio';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// Drop-bar frames; P-series (TT), ZHT/ZFS (MTB) and Rouvida (e-bike) are left out.
const SLUG = /^(s[1-5]|r[2-5]|c[1-5]|caledonia(?:-5)?|aspero(?:-5)?|soloist|r5-cx)(-disc)?(?:-(20\d\d))?$/;
const LINE = /\b(R5[- ]?CX|S[1-5]|R[2-5]|C[1-5]|Caledonia(?:-5)?|[ÁA]spero(?:-5)?|Soloist)\b/i;

const ascii = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function slugOf(url: string): { locale: string; path: string; slug: string } | null {
  const m = url.replace(/[?#].*$/, '').match(/^https?:\/\/(?:www\.)?cervelo\.com(?::80)?\/(en-US|en_US|en)\/(.+?)\/?$/);
  if (!m) return null;
  let path: string;
  try {
    path = decodeURIComponent(m[2]);
  } catch {
    return null;
  }
  const p = ascii(path).toLowerCase().split('/');
  let slug: string | undefined;
  if (p[0] === 'bikes' && (p.length === 2 || p.length === 3)) slug = p[p.length - 1];
  else if (m[1] !== 'en-US' && p.length === 1) slug = p[0];
  // 2018: the geometry sits on a 'specs and geometry' subpage.
  else if (p[0] === 'road' && p.length === 4 && p[3] === 'specs and geometry') slug = p[2];
  return slug ? { locale: m[1], path, slug } : null;
}

/** Sizes from the 2019-2021 chart: one <ul class="geo-col"> per size, fields keyed by data-fieldid. */
function geoChart(html: string) {
  const $ = cheerio.load(html);
  const chart = $('.geo-chart').first();
  if (!chart.length) return [];
  const head = chart.find('ul.geo-row--header').first();
  const ids = head.find('li[data-fieldid]').toArray().map((li) => $(li).attr('data-fieldid')!);
  const labels = head.find('li[data-fieldid]').toArray().map((li) => $(li).find('.geo-col__th-value').text().trim() || $(li).text().trim());
  const rows = chart.find('ul.geo-col').not('.geo-row--header').toArray().map((ul) => ids.map((id) => {
    const li = $(ul).find(`li[data-fieldid="${id}"]`).first();
    const metric = li.find('.js-metric');
    return (metric.length ? metric.text() : li.text()).trim();
  }));
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const table = `<table><tr>${labels.map((l) => `<th>${esc(l)}</th>`).join('')}</tr>`
    + rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') + '</table>';
  return geometryTables(table);
}

const adapter: Adapter = {
  brand: 'Cervélo',
  file: 'cervelo',
  prefixes: ['www.cervelo.com/en-US/bikes/', 'www.cervelo.com/en/', 'www.cervelo.com/en_US/'],
  seeds: [],
  accept(url) {
    const s = slugOf(url);
    const m = s?.slug.match(SLUG);
    if (!s || !m) return null;
    const path = s.path.split('/').map((x) => encodeURIComponent(x)).join('/');
    return { url: `https://www.cervelo.com/${s.locale}/${path}`, family: [m[1], m[3]].filter(Boolean).join('-') };
  },
  extract(page) {
    let tables = geometryTables(page.html);
    if (!tables.length) tables = geoChart(page.html);
    if (!tables.length) return [];
    const $ = cheerio.load(page.html);
    const title = $('head title').first().text() || $('title').first().text();
    const slug = slugOf(page.url)?.slug ?? '';
    const line = title.match(LINE)?.[1] ?? slug.match(SLUG)?.[1]?.replace(/^./, (c) => c.toUpperCase());
    if (!line) return [];
    const model = ascii(line)
      .replace(/^aspero/i, 'Áspero').replace(/^caledonia/i, 'Caledonia').replace(/^soloist/i, 'Soloist')
      .replace(/^r5[- ]?cx$/i, 'R5-CX').replace(/^([src])(\d)$/i, (_, a: string, b: string) => a.toUpperCase() + b);
    const year = Number(slug.match(SLUG)?.[3]) || undefined;
    const category = categoryFrom(model, [
      [/cx/i, 'cyclocross'], [/^S\d/, 'aero'], [/caledonia|^C\d/i, 'endurance'], [/spero/i, 'gravel'],
    ], 'race');
    return [{ model, year, category, sizes: tables[0] }];
  },
};
export default adapter;
