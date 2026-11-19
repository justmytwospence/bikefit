import { describe, expect, it } from 'vitest';
import { nearStems } from '../lib/catalogFit';
import { betweenSizes, rankSizes, type SizeEntry } from '../lib/sizes';
import { resolveSegments } from './body';
import { compareFrames, idealLayout, optimizeFit } from './optimize';
import { DEFAULT_BODY, DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS } from './presets';
import { makeContext, poseWeights } from './riding';
import { nominalStem } from './score';
import { bandsFor, STYLES } from './styles';
import type { Frame, StyleId } from './types';

type Row = [size: string, stack: number, reach: number, sta: number, hta: number, ht: number, st: number, cs: number, wb: number, bbDrop: number];
interface Ref { name: string; maxSpacers: number; tyreWidth: number; rows: Row[]; stock: number[]; chart: [number, number][] }

/** Specialized Tarmac SL8: geometry, stock stem and rider height range (cm) per size, as published. */
const TARMAC: Ref = {
  name: 'tarmac', maxSpacers: 30, tyreWidth: 28,
  rows: [
    ['44', 501, 366, 75.5, 70.5, 99, 433, 410, 970, 74],
    ['49', 514, 375, 75.5, 71.8, 109, 445, 410, 973, 74],
    ['52', 527, 380, 74, 72.5, 120, 456, 410, 975, 74],
    ['54', 544, 384, 74, 73, 137, 473, 410, 978, 72],
    ['56', 565, 395, 73.5, 73.5, 157, 494, 410, 991, 72],
    ['58', 591, 402, 73.5, 73.5, 184, 515, 410, 1006, 72],
    ['61', 612, 408, 73, 74, 204, 545, 410, 1013, 72],
  ],
  stock: [70, 80, 90, 100, 100, 110, 110],
  chart: [[142, 155], [155, 163], [163, 170], [170, 175], [175, 180], [180, 188], [188, 196]],
};
/** Trek Domane SL/SLR (2019 to 2023 carbon): geometry, stock stem and rider height range per size, as published. */
const DOMANE: Ref = {
  name: 'domane', maxSpacers: 40, tyreWidth: 32,
  rows: [
    ['47', 527, 364, 74.6, 71, 110, 420, 420, 986, 80],
    ['50', 546, 368, 74.6, 71.1, 130, 450, 420, 996, 80],
    ['52', 561, 371, 74.2, 71.3, 145, 475, 420, 1003, 80],
    ['54', 575, 374, 73.7, 71.3, 160, 500, 420, 1010, 80],
    ['56', 591, 377, 73.3, 71.9, 175, 525, 420, 1008, 78],
    ['58', 611, 380, 73, 72, 195, 548, 425, 1022, 78],
    ['60', 632, 383, 72.8, 72.1, 220, 567, 425, 1032, 75],
    ['62', 656, 386, 72.5, 72.1, 245, 586, 425, 1042, 75],
  ],
  stock: [70, 80, 90, 90, 100, 100, 110, 110],
  chart: [[152, 158], [158, 163], [163, 168], [168, 174], [174, 180], [180, 185], [185, 190], [190, 195]],
};
// Bikes the bands were not anchored on, to check the picks carry over. Geometry from the catalog,
// height ranges from each maker's own pages (Giant's overlap, as published).
/** Canyon Ultimate CF SLX (2023 on). */
const ULTIMATE: Ref = {
  name: 'ultimate', maxSpacers: 30, tyreWidth: 28,
  rows: [
    ['2XS', 498, 372, 73.5, 70, 88, 420, 410, 975, 73],
    ['XS', 520, 378, 73.5, 71.2, 107, 450, 410, 979, 73],
    ['S', 539, 390, 73.5, 72.8, 121, 480, 410, 982, 73],
    ['M', 560, 393, 73.5, 73.3, 142, 510, 410, 988, 73],
    ['L', 580, 401, 73.5, 73.3, 162, 540, 413, 1003, 73],
    ['XL', 606, 419, 73.5, 73.5, 188, 570, 415, 1029, 73],
    ['2XL', 624, 429, 73.5, 73.8, 206, 600, 415, 1042, 73],
  ],
  stock: [],
  chart: [[160, 166], [166, 172], [172, 178], [178, 184], [184, 190], [190, 196], [196, 202]],
};
/** Canyon Endurace CF SLX (2023). */
const ENDURACE: Ref = {
  name: 'endurace', maxSpacers: 40, tyreWidth: 32,
  rows: [
    ['XS', 532, 370, 72.7, 71, 115, 462, 415, 982, 75],
    ['S', 557, 376, 73.5, 72, 139, 492, 415, 988, 73],
    ['M', 578, 382, 73.5, 73, 158, 522, 415, 990, 73],
    ['L', 604, 389, 73.5, 73, 184, 552, 415, 1006, 73],
    ['XL', 625, 407, 73.5, 73.3, 206, 582, 415, 1028, 73],
  ],
  stock: [],
  chart: [[165, 171], [171, 178], [178, 185], [185, 192], [192, 198]],
};
/** Giant TCR Advanced (2021 on). */
const TCR: Ref = {
  name: 'tcr', maxSpacers: 30, tyreWidth: 28,
  rows: [
    ['XS', 517, 376, 74.5, 71, 120, 425, 405, 976, 72],
    ['S', 528, 383, 74, 72.3, 130, 445, 405, 977, 69.5],
    ['M', 545, 388, 73.5, 73.5, 145, 470, 405, 980, 69.5],
    ['ML', 562, 393, 73, 73, 165, 500, 405, 991, 67],
    ['L', 581, 402, 73, 73, 185, 530, 405, 1006, 67],
    ['XL', 596, 412, 72.5, 72.5, 200, 560, 405, 1020, 67],
  ],
  stock: [],
  chart: [[157, 169], [165, 175], [171, 181], [177, 187], [183, 193], [189, 199]],
};

const frames = (ref: Ref): Frame[] => ref.rows.map(([size, stack, reach, sta, hta, ht, st, cs, wb, bbDrop]) => ({
  id: `${ref.name}-${size}`, name: `${ref.name} · ${size}`, stack, reach, seatTubeAngle: sta, headTubeAngle: hta,
  headTubeLength: ht, seatTubeLength: st, chainstay: cs, wheelbase: wb, bbDrop, maxSpacers: ref.maxSpacers, tyreWidth: ref.tyreWidth,
}));

function rider(style: StyleId, heightMm: number) {
  const inseam = Math.round(0.472 * heightMm);
  const st = STYLES[style];
  const segments = resolveSegments({ ...DEFAULT_BODY, height: heightMm, inseam, shoeSizeAuto: true });
  const targets = bandsFor(st, 'medium', heightMm);
  const w = poseWeights(st.defaultHands);
  const ideal = idealLayout(segments, targets, w, makeContext(null, DEFAULT_COMPONENTS, 'neutral', st.defaultEffort), DEFAULT_COMPONENTS, DEFAULT_OPTIONS.crankLengths);
  return {
    segments, inseam, targets, poseWeights: w, ankling: 'neutral' as const, effort: st.defaultEffort,
    components: DEFAULT_COMPONENTS, options: DEFAULT_OPTIONS, baseline: DEFAULT_PARAMS, idealHoods: ideal.hoods, stock: st.stock,
  };
}

const memo = new Map<string, SizeEntry[]>();
/** Every size of a reference bike for this rider, as Find a bike checks them, in size order with their standing. */
function sizes(ref: Ref, style: StyleId, heightMm: number): SizeEntry[] {
  const key = `${ref.name}/${style}/${heightMm}`;
  let out = memo.get(key);
  if (!out) {
    const base = rider(style, heightMm);
    out = rankSizes(frames(ref).map((f, i) => ({
      size: ref.rows[i][0], frame: f,
      row: compareFrames({ ...base, options: { ...DEFAULT_OPTIONS, ...nearStems(f, DEFAULT_COMPONENTS, DEFAULT_OPTIONS, base.idealHoods) } }, [f])[0],
    })));
    memo.set(key, out);
  }
  return out;
}
const pickIndex = (e: SizeEntry[]) => e.findIndex((x) => x.standing === 'pick');
const scoreOf = (e: SizeEntry[], size: string) => e.find((x) => x.size === size)!.row.result.score;
const mid = (ref: Ref, i: number) => Math.round((ref.chart[i][0] + ref.chart[i][1]) * 5);

describe('nominalStem', () => {
  it('is within 12 mm of the stock stem on every reference size', () => {
    for (const ref of [TARMAC, DOMANE]) {
      frames(ref).forEach((f, i) => expect(Math.abs(nominalStem(f) - ref.stock[i]), f.id).toBeLessThanOrEqual(12));
    }
  });
});

describe('style anchors', () => {
  // The build each style is anchored on, held fixed while the saddle is optimized.
  const cases: [StyleId, Ref, number, number][] = [
    ['endurance', DOMANE, 25, 0],
    ['sport', TARMAC, 20, 0],
    ['race', TARMAC, 0, 10],
  ];
  it.each(cases)('%s: the reference build sits mid-band on the hoods at every middle size', (style, ref, spacers, extraStem) => {
    const off = { torso: 0, shoulder: 0 };
    const idx = [2, 3, 4, 5];
    for (const i of idx) {
      const base = rider(style, mid(ref, i));
      const cur = { ...DEFAULT_PARAMS, stemLength: ref.stock[i] + extraStem, stemAngle: -6, spacers };
      const r = optimizeFit({
        ...base, frame: frames(ref)[i], current: cur, baseline: cur, mode: 'tune',
        locks: { stemLength: true, stemAngle: true, spacers: true, crankLength: true },
      });
      const b = base.targets[0].bands;
      const m = r.evaluation.poses[0].metrics;
      off.torso += (m.torso - (b.torso!.min + b.torso!.max) / 2) / idx.length;
      off.shoulder += (m.shoulder - (b.shoulder!.min + b.shoulder!.max) / 2) / idx.length;
    }
    expect(Math.abs(off.torso)).toBeLessThan(1);
    expect(Math.abs(off.shoulder)).toBeLessThan(1.5);
  });
});

describe('size picks against manufacturer charts', () => {
  const anchors: [StyleId, Ref][] = [['sport', TARMAC], ['endurance', DOMANE], ['race', TARMAC]];
  it.each(anchors)('%s: a rider in the middle of any chart size gets that size', (style, ref) => {
    ref.chart.forEach((_, i) => expect(ref.rows[pickIndex(sizes(ref, style, mid(ref, i)))][0], `chart size ${ref.rows[i][0]}`).toBe(ref.rows[i][0]));
  }, 120000);
  it('the right size wins clearly in the middle of its range', () => {
    for (const i of [3, 4]) {
      const e = sizes(TARMAC, 'sport', mid(TARMAC, i));
      const best = e[i].row.result.score;
      expect(best).toBeGreaterThanOrEqual(95);
      expect(betweenSizes(e)).toBeNull();
      expect(e[i - 1].row.result.score).toBeLessThanOrEqual(best - 10);
      expect(e[i + 1].row.result.score).toBeLessThanOrEqual(best - 10);
      expect(e[i - 2].row.result.score).toBeLessThanOrEqual(best - 40);
    }
  }, 60000);
  it('a rider where two sizes meet is between them', () => {
    expect(betweenSizes(sizes(TARMAC, 'sport', 1750))!.map((x) => x.size)).toEqual(['54', '56']);
    expect(betweenSizes(sizes(TARMAC, 'sport', 1830))!.map((x) => x.size)).toEqual(['56', '58']);
  }, 60000);
  it('rules out sizes that are far off', () => {
    expect(scoreOf(sizes(TARMAC, 'sport', 1775), '44')).toBeLessThan(20);
    // A 160 cm rider cannot stand over the largest frame at all.
    expect(sizes(TARMAC, 'sport', 1600).find((x) => x.size === '61')!.standing).toBe('no');
  }, 60000);
  it('marks a bike down for a style it was not built for', () => {
    const best = (ref: Ref, style: StyleId, h: number) => { const e = sizes(ref, style, h); return e[pickIndex(e)].row.result; };
    expect(best(TARMAC, 'endurance', 1775).score).toBeLessThanOrEqual(best(DOMANE, 'endurance', 1770).score - 15);
    expect(best(DOMANE, 'sport', 1770).score).toBeLessThanOrEqual(best(TARMAC, 'sport', 1775).score - 15);
    expect(best(TARMAC, 'endurance', 1775).verdict).toBe('compromise');
  }, 60000);
  const others: [StyleId, Ref][] = [['sport', ULTIMATE], ['endurance', ENDURACE], ['sport', TCR]];
  it.each(others)('%s on a bike of another make stays within one size of its chart', (style, ref) => {
    ref.chart.forEach((_, i) => expect(Math.abs(pickIndex(sizes(ref, style, mid(ref, i))) - i), `chart size ${ref.rows[i][0]}`).toBeLessThanOrEqual(1));
  }, 120000);
});
