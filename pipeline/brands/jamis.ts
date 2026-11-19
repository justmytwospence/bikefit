import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { categoryFrom } from '../lib/category';
import { geometryTables } from '../lib/extract';
import type { Adapter, Extracted } from '../types';

type Material = 'Carbon' | 'Steel' | 'Alloy';

// Two sites. Until 2021 an Adobe Muse site, one static page per build (/usa/xenithcomp.html): a single geometry table
// whose rows are sizes. Since 2021 a WordPress site with one page per family and a table whose first column names the
// builds a row belongs to ('C1, C2', 'S2', 'A1, A2 Women's').
const MUSE = /^https?:\/\/(?:www\.)?jamisbikes\.com(?::80)?\/usa\/([a-z0-9_-]+)\.html$/;
const WORDPRESS = /^https?:\/\/(?:www\.)?jamisbikes\.com(?::80)?\/bikes\/adventure-gravel\/(?:road|all-road|allroad-adventure|gravel-adventure)\/([a-z-]+?)\/?$/;

/** Muse pages that are not one bike: series and women's pages repeat the builds, frame pages are frame kits. */
const MUSE_SKIP = /series|femme|frame|^rba_|^(?:xenith|icon|quest|ventura)$/;

/** The Renegade builds of the Muse site by frame: carbon (Elite, Expert, C1, C2), steel (Exploit, Escapade, Expat, S1-S4), alloy (Exile, Explore, A1). */
function renegadeMaterial(rest: string): Material | null {
  if (/^(?:elite|expert|c\d)$/.test(rest)) return 'Carbon';
  if (/^(?:exploit|escapade|expat|ltd|s\d)$/.test(rest)) return 'Steel';
  if (/^(?:exile|explore|a\d)$/.test(rest)) return 'Alloy';
  return null;
}

/** Frame family of a Muse page slug: one key per frame, so discovery tries every frame in every period. */
function museFamily(slug: string): string | null {
  if (MUSE_SKIP.test(slug)) return null;
  const renegade = slug.match(/^renegade-?([a-z0-9]+)$/);
  if (renegade) {
    const material = renegadeMaterial(renegade[1]);
    return material ? `renegade-${material.toLowerCase()}` : null;
  }
  if (/^novapro$/.test(slug)) return 'nova';
  const line = slug.match(/^(xenith|icon|quest|ventura|aurora|supernova)(?:[a-z0-9]*)$/);
  return line ? line[1] : null;
}

/** Frame family of a WordPress page slug; null for listings, frame kits and other bikes. */
function wordpressFamily(slug: string): string | null {
  if (/^(?:new-)?renegade$/.test(slug)) return 'renegade';
  const single = slug.match(/^(carbon|steel|alloy)-renegade$/);
  if (single) return `renegade-${single[1]}`;
  return slug === 'ventura' || slug === 'ventura-allroad' ? slug : null;
}

const LINE_NAMES: Record<string, string> = {
  xenith: 'Xenith', icon: 'Icon', quest: 'Quest', ventura: 'Ventura', aurora: 'Aurora', supernova: 'Supernova', nova: 'Nova',
};

/** The frame family and canonical path of a captured URL, or null for anything that is not a drop-bar bike page. */
function classify(url: string): { family: string; path: string } | null {
  const clean = url.replace(/[?#].*$/, '');
  const muse = clean.match(MUSE);
  if (muse) {
    const family = museFamily(muse[1]);
    return family ? { family, path: `/usa/${muse[1]}.html` } : null;
  }
  const wp = clean.match(WORDPRESS);
  if (wp) {
    const family = wordpressFamily(wp[1]);
    return family ? { family, path: clean.replace(/^https?:\/\/[^/]+/, '').replace(/\/?$/, '/') } : null;
  }
  return null;
}

const MM = /^\s*[\d.,]+\s*\/\s*([\d.,]+)\s*$/;
const HEADERS: Record<string, string> = { 'ht angle': 'Head Tube Angle', 'st angle': 'Seat Tube Angle', headtube: 'Head Tube Length', 'seat tube': 'Seat Tube Length' };

/** A size label as riders know it: '44*' and '44 650' (the 650b wheel run of the smallest sizes) are size 44. */
const sizeLabel = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/\s*\*+$/, '').replace(/^(\d{2})\s+\d{3}[a-z]?$/i, '$1');

interface Group { label: string; html: string; year?: number }

/**
 * The geometry tables of a page, split by build group. Lengths come as 'inches / millimetres' cells: keep the
 * millimetres. WordPress tables lead with a MODEL column that names the builds; it is read, then dropped.
 */
function groups(html: string): Group[] {
  const $ = cheerio.load(html);
  const out: Group[] = [];
  $('table').each((_, table) => {
    const rows = $(table).find('tr').toArray();
    const head = $(rows[0]).children('th,td').toArray().map((c) => $(c).text().replace(/\s+/g, ' ').trim());
    if (!head.some((h) => /^stack/i.test(h)) || !head.some((h) => /^reach/i.test(h))) return;
    const hasModel = /^model$/i.test(head[0]);
    const year = Number($(table).attr('aria-label')?.match(/^\s*(20\d\d)\b/)?.[1]) || undefined;
    const labels = head.slice(hasModel ? 1 : 0).map((h) => HEADERS[h.toLowerCase()] ?? h);
    const byLabel = new Map<string, string[]>();
    for (const tr of rows.slice(1)) {
      const cells = $(tr).children('td,th').toArray().map((c) => $(c).text().replace(/\s+/g, ' ').trim());
      const label = hasModel ? cells[0] : '';
      const row = cells.slice(hasModel ? 1 : 0).map((c, i) => (i === 0 ? sizeLabel(c) : c.replace(MM, '$1')));
      byLabel.set(label, [...(byLabel.get(label) ?? []), `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`]);
    }
    for (const [label, trs] of byLabel) {
      out.push({ label, year, html: `<table><tr>${labels.map((h) => `<th>${h}</th>`).join('')}</tr>${trs.join('')}</table>` });
    }
  });
  return out;
}

/** The frame a build group is: 'C1, C2' is the carbon Renegade, 'S2' the steel one, 'Women's' the women's Ventura. */
function nameOf(family: string, label: string): string {
  if (family === 'ventura') return /women/i.test(label) ? "Ventura Women's" : 'Ventura';
  if (family === 'ventura-allroad') return 'Ventura All-Road';
  const fixed = family.match(/^renegade-(carbon|steel|alloy)$/);
  if (fixed) return `Renegade ${fixed[1][0].toUpperCase()}${fixed[1].slice(1)}`;
  if (family === 'renegade') {
    // 'C1, C2', 'S3/S4 Series', 'New Renegade C1, C2, C3, C4', 'Renegade A-Series'.
    const key = label.match(/\b([csa])(?:\d|-series)/i)?.[1].toLowerCase();
    const material = key && { c: 'Carbon', s: 'Steel', a: 'Alloy' }[key];
    return material ? `Renegade ${material}` : '';
  }
  return LINE_NAMES[family] ?? '';
}

const adapter: Adapter = {
  brand: 'Jamis',
  file: 'jamis',
  // The Muse site lists every bike of the brand: only the drop-bar lines are asked for, as prefixes.
  prefixes: [
    'www.jamisbikes.com/usa/xenith', 'www.jamisbikes.com/usa/icon', 'www.jamisbikes.com/usa/quest',
    'www.jamisbikes.com/usa/ventura', 'www.jamisbikes.com/usa/aurora', 'www.jamisbikes.com/usa/supernova',
    'www.jamisbikes.com/usa/novapro', 'www.jamisbikes.com/usa/renegade',
    'www.jamisbikes.com/bikes/adventure-gravel/',
  ],
  seeds: [],
  accept(url) {
    const c = classify(url);
    return c ? { url: `https://www.jamisbikes.com${c.path}`, family: c.family } : null;
  },
  extract(page) {
    const c = classify(page.url);
    if (!c) return [];
    const found: Extracted[] = [];
    for (const g of groups(page.html)) {
      // The Muse pages are one frame; WordPress pages name it by build group.
      const model = nameOf(c.family, g.label);
      const sizes = geometryTables(g.html)[0];
      if (!model || !sizes) continue;
      const category: FrameCategory = categoryFrom(model, [[/xenith|icon/i, 'race'], [/nova/i, 'cyclocross'], [/renegade/i, 'gravel']], 'endurance');
      found.push({ model, year: g.year, category, sizes });
    }
    // S2, S3 and S4 share a frame and a row set: one model. Two sets under one name (Steel S1/S2 and S3/S4) keep their builds in the name.
    const out: Extracted[] = [];
    for (const e of found) {
      const same = out.filter((o) => o.model === e.model);
      if (same.some((o) => JSON.stringify(o.sizes) === JSON.stringify(e.sizes))) continue;
      out.push(e);
    }
    const clash = new Set(out.filter((e, i) => out.findIndex((o) => o.model === e.model) !== i).map((e) => e.model));
    if (clash.size) {
      const labels = groups(page.html);
      for (const e of out) {
        if (!clash.has(e.model)) continue;
        const g = labels.find((l) => JSON.stringify(geometryTables(l.html)[0]) === JSON.stringify(e.sizes));
        const builds = g?.label.match(/[CSA]\d(?:\s*[/,]\s*[CSA]?\d)*/i)?.[0].replace(/\s+/g, '');
        if (builds) e.model = `${e.model} ${builds}`;
      }
    }
    return out;
  },
};
export default adapter;
