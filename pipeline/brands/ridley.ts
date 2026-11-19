import * as cheerio from 'cheerio';
import type { FrameCategory } from '../../src/data/schema';
import { geometryTables } from '../lib/extract';
import type { Adapter } from '../types';

// The shop at ridley-bikes.com/en_US/bikes/<SKU> (April 2021 on). Every build and frameset of a frame has its own page, named
// by a SKU: SBI (complete bike) or FFS (frame and fork), the frame's three-character code, RID, and a number (some have a letter
// before it: SBIXNIRIDF28). The code says which frame it is; the page title is the build ('Noah FAST 7E8 Ultegra Di2 NF301Am(M)') from 2024, and only older pages have a
// clean heading. The 2019 and 2020 site (/product/<slug>/) shows its geometry as an image, so it is not accepted.
const SKU = /^https?:\/\/(?:www\.)?ridley-bikes\.com(?::80)?\/en_US\/bikes\/((?:SBI|FFS)([A-Z0-9]{3})RID[A-Z]?\d+)\/?(?:[?#].*)?$/;

/**
 * The drop-bar frames by SKU code. Not here, so not accepted: e-bikes (ENO, EGC, EAS, EAC, XAE Kanzo E), time-trial and
 * triathlon (DEF, DFD Dean, TRI Triton, ISX Ignite SLX), track (ARA, ARC, ARO, AF2, OF2), mountain (IA9, IRS, PRS, RAF, SAB,
 * BL9), Kalazy (KEC), urban and kids (U40, U5M, U5W, U8M, U8X, URB, YUN).
 * Names follow pipeline/overrides/ridley.json where a page covers the same frame ('Noah Fast', 'Helium', 'Grifn', 'Kanzo Fast').
 */
const FRAMES: Record<string, { model: string; category: FrameCategory }> = {
  NF3: { model: 'Noah Fast', category: 'aero' },
  NFD: { model: 'Noah Fast Disc', category: 'aero' },
  NH3: { model: 'Noah', category: 'aero' },
  NOA: { model: 'Noah', category: 'aero' },
  NHD: { model: 'Noah Disc', category: 'aero' },
  NOD: { model: 'Noah Aero+', category: 'aero' },
  HED: { model: 'Helium', category: 'race' },
  HXD: { model: 'Helium SLX', category: 'race' },
  HSX: { model: 'Helium SLX', category: 'race' },
  HSA: { model: 'Helium SLA', category: 'race' },
  FAL: { model: 'Falcn', category: 'race' },
  FRS: { model: 'Falcn RS', category: 'race' },
  FR2: { model: 'Falcn RS 2.0', category: 'race' },
  FEN: { model: 'Fenix Disc', category: 'endurance' },
  FSD: { model: 'Fenix SLiC', category: 'endurance' },
  FAD: { model: 'Fenix SLA', category: 'endurance' },
  KAR: { model: 'Grifn', category: 'endurance' },
  KAL: { model: 'Grifn A', category: 'endurance' },
  GRS: { model: 'Grifn RS', category: 'endurance' },
  KAD: { model: 'Kanzo Adventure', category: 'gravel' },
  XTC: { model: 'Kanzo Adventure 1.0', category: 'gravel' },
  KAV: { model: 'Kanzo Adventure Alu', category: 'gravel' },
  XTA: { model: 'Kanzo A', category: 'gravel' },
  XTR: { model: 'Kanzo Speed', category: 'gravel' },
  KAF: { model: 'Kanzo Fast', category: 'gravel' },
  KF2: { model: 'Kanzo Fast', category: 'gravel' },
  AST: { model: 'ASTR', category: 'gravel' },
  ARS: { model: 'ASTR RS', category: 'gravel' },
  XRI: { model: 'X-Ride', category: 'cyclocross' },
  XNI: { model: 'X-Night', category: 'cyclocross' },
  XRS: { model: 'X-Night RS', category: 'cyclocross' },
};

/** The frame's family: its name, so each frame gets its own page per period (KAF and KF2 are both 'Kanzo Fast'). */
const FAMILY: Record<string, string> = Object.fromEntries(
  Object.entries(FRAMES).map(([code, f]) => [code, f.model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '') + (code === 'KF2' ? '-2' : '')]),
);

/**
 * The geometry table labels its rows with the letters of the drawing. A, C and J (standover, top tube and an unused row, and two more on the 2020 Noah) carry
 * nothing the catalog keeps. The letters were matched to the measurements on the pages and to the hand-entered rows in
 * overrides/ridley.json: the same twelve letters, in the same order, head every table from 2021 to 2026.
 */
const ROWS: Record<string, string> = {
  B: 'Seat Tube Length', D: 'Head Tube Length', E: 'Seat Tube Angle', F: 'Head Tube Angle', G: 'Chainstay Length',
  H: 'BB Drop', I: 'Wheelbase', S: 'Stack', R: 'Reach',
};

const adapter: Adapter = {
  brand: 'Ridley',
  file: 'ridley',
  // Complete bikes (SBI) and framesets (FFS) of the frames in FRAMES, as far as a prefix goes without taking the others.
  prefixes: [
    'www.ridley-bikes.com/en_US/bikes/SBIN', 'www.ridley-bikes.com/en_US/bikes/SBIH', 'www.ridley-bikes.com/en_US/bikes/SBIF',
    'www.ridley-bikes.com/en_US/bikes/SBIKA', 'www.ridley-bikes.com/en_US/bikes/SBIKF', 'www.ridley-bikes.com/en_US/bikes/SBIGRS',
    'www.ridley-bikes.com/en_US/bikes/SBIARS', 'www.ridley-bikes.com/en_US/bikes/SBIAST', 'www.ridley-bikes.com/en_US/bikes/SBIXN',
    'www.ridley-bikes.com/en_US/bikes/SBIXR', 'www.ridley-bikes.com/en_US/bikes/SBIXT',
    'www.ridley-bikes.com/en_US/bikes/FFSN', 'www.ridley-bikes.com/en_US/bikes/FFSH', 'www.ridley-bikes.com/en_US/bikes/FFSF',
    'www.ridley-bikes.com/en_US/bikes/FFSKA', 'www.ridley-bikes.com/en_US/bikes/FFSKF', 'www.ridley-bikes.com/en_US/bikes/FFSGRS',
    'www.ridley-bikes.com/en_US/bikes/FFSARS', 'www.ridley-bikes.com/en_US/bikes/FFSAST', 'www.ridley-bikes.com/en_US/bikes/FFSXN',
    'www.ridley-bikes.com/en_US/bikes/FFSXR', 'www.ridley-bikes.com/en_US/bikes/FFSXT',
  ],
  seeds: [],
  accept(url) {
    const m = url.match(SKU);
    if (!m || !FRAMES[m[2]]) return null;
    return { url: `https://www.ridley-bikes.com/en_US/bikes/${m[1]}`, family: FAMILY[m[2]] };
  },
  extract(page) {
    const frame = FRAMES[page.url.match(SKU)?.[2] ?? ''];
    if (!frame) return [];
    const $ = cheerio.load(page.html);
    // The Kanzo Adventure Alu is also sold with a flat bar (Shimano CUES): the frame is the same, the build is not a drop-bar bike.
    if (/\bCUES\b/i.test($('title').text())) return [];
    const table = $('table.table--geo').first();
    if (!table.length) return [];
    table.find('tbody tr').each((_, tr) => {
      const first = $(tr).children('td,th').first();
      const label = ROWS[first.text().trim()];
      if (label) first.text(label);
      else $(tr).remove();
    });
    const sizes = geometryTables($.html(table))[0];
    if (!sizes) return [];
    // The shop's data names the collection a bike belongs to ('Collection Ridley 2022', 'Collection Mud 2023', 'Ridley Collection
    // 2026'): its model year. Pages of the newest bikes do not state one.
    const year = Number(page.html.match(/collection_year:"[^"]*?\b(20\d\d)"/)?.[1]) || undefined;
    return [{ model: frame.model, year, category: frame.category, sizes }];
  },
};
export default adapter;
