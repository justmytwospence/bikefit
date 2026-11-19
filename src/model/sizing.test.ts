import { describe, expect, it } from 'vitest';
import { resolveSegments } from './body';
import { optimizeFit } from './optimize';
import { DEFAULT_BODY, DEFAULT_COMPONENTS, DEFAULT_OPTIONS, DEFAULT_PARAMS } from './presets';
import { poseWeights } from './riding';
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

const frames = (ref: Ref): Frame[] => ref.rows.map(([size, stack, reach, sta, hta, ht, st, cs, wb, bbDrop]) => ({
  id: `${ref.name}-${size}`, name: `${ref.name} · ${size}`, stack, reach, seatTubeAngle: sta, headTubeAngle: hta,
  headTubeLength: ht, seatTubeLength: st, chainstay: cs, wheelbase: wb, bbDrop, maxSpacers: ref.maxSpacers, tyreWidth: ref.tyreWidth,
}));

function rider(style: StyleId, heightMm: number) {
  const inseam = Math.round(0.472 * heightMm);
  const st = STYLES[style];
  const segments = resolveSegments({ ...DEFAULT_BODY, height: heightMm, inseam, shoeSizeAuto: true });
  const targets = bandsFor(st, 'medium');
  const w = poseWeights(st.defaultHands);
  return {
    segments, inseam, targets, poseWeights: w, ankling: 'neutral' as const, effort: st.defaultEffort,
    components: DEFAULT_COMPONENTS, options: DEFAULT_OPTIONS, baseline: DEFAULT_PARAMS,
  };
}

const mid = (ref: Ref, i: number) => Math.round((ref.chart[i][0] + ref.chart[i][1]) * 5);

describe('style anchors', () => {
  // The build each style is anchored on, held fixed while the saddle is optimized.
  const cases: [StyleId, Ref, number, number][] = [
    ['endurance', DOMANE, 25, 0],
    ['sport', TARMAC, 20, 0],
    ['race', TARMAC, 0, 10],
  ];
  it.each(cases)('%s: the reference build sits mid-band on the hoods', (style, ref, spacers, extraStem) => {
    const sum = { torso: 0, shoulder: 0 };
    const idx = [2, 3, 4, 5];
    for (const i of idx) {
      const base = rider(style, mid(ref, i));
      const cur = { ...DEFAULT_PARAMS, stemLength: ref.stock[i] + extraStem, stemAngle: -6, spacers };
      const r = optimizeFit({
        ...base, frame: frames(ref)[i], current: cur, baseline: cur, mode: 'tune',
        locks: { stemLength: true, stemAngle: true, spacers: true, crankLength: true },
      });
      sum.torso += r.evaluation.poses[0].metrics.torso / idx.length;
      sum.shoulder += r.evaluation.poses[0].metrics.shoulder / idx.length;
    }
    const b = bandsFor(STYLES[style], 'medium')[0].bands;
    expect(Math.abs(sum.torso - (b.torso!.min + b.torso!.max) / 2)).toBeLessThan(1);
    expect(Math.abs(sum.shoulder - (b.shoulder!.min + b.shoulder!.max) / 2)).toBeLessThan(1.5);
  });
});
