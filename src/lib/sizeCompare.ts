import { fmtNum } from '../model/advice';
import type { LinkId } from './linkIds';
import type { SizeEntry } from './sizes';

export interface CompareLine {
  label: string;
  /** Value on the smaller frame, then on the larger one. */
  values: [string, string];
  /** Which side most riders would call the better one for this line, when one is. */
  better: 0 | 1 | null;
  /** The part of the drawing this line measures, when there is one. */
  link?: LinkId;
}

export interface SizeComparison {
  sizes: [string, string];
  lines: CompareLine[];
  /** One sentence per size on what choosing it means. */
  gist: [string, string];
}

const stem = (e: SizeEntry) => {
  const p = e.row.result.params;
  const a = p.stemAngle;
  return `${fmtNum(p.stemLength)} mm ${a < 0 ? '−' : a > 0 ? '+' : ''}${Math.abs(a)}°`;
};
const mm = (n: number) => `${Math.round(n)} mm`;
const higher = (a: number, b: number): 0 | 1 | null => (Math.abs(a - b) < 0.5 ? null : a > b ? 0 : 1);

/**
 * What changes between two neighbouring sizes of one model that both fit: `small` is the smaller frame.
 * Both builds put the rider in nearly the same position, so the lines are about what is left over:
 * room to move the bars, how the parts differ from stock, clearances and handling.
 */
export function compareSizes(small: SizeEntry, large: SizeEntry): SizeComparison {
  const [a, b] = [small, large];
  const pa = a.row.result.params;
  const pb = b.row.result.params;
  const fa = a.row.result.facts;
  const fb = b.row.result.facts;
  const up = (e: SizeEntry) => e.frame.maxSpacers - e.row.result.params.spacers;
  const lines: CompareLine[] = [
    { label: 'Stem', values: [stem(a), stem(b)], better: null, link: 'stem' },
    { label: 'Room to lower the bars', values: [mm(pa.spacers), mm(pb.spacers)], better: higher(pa.spacers, pb.spacers), link: 'spacers' },
    { label: 'Room to raise the bars', values: [mm(up(a)), mm(up(b))], better: higher(up(a), up(b)), link: 'f:maxSpacers' },
    { label: 'Seatpost showing', values: [mm(fa.seatpost), mm(fb.seatpost)], better: null, link: 'r:seatpost' },
    {
      label: 'Standover clearance',
      values: [fa.standover < 0 ? 'tight' : mm(fa.standover), fb.standover < 0 ? 'tight' : mm(fb.standover)],
      better: higher(fa.standover, fb.standover),
    },
  ];
  if (Number.isFinite(fa.toeClearance) && Number.isFinite(fb.toeClearance) && (fa.toeClearance < 20 || fb.toeClearance < 20)) {
    const toe = (t: number) => (t < 0 ? `${Math.round(-t)} mm overlap` : `${Math.round(t)} mm clear`);
    lines.push({ label: 'Toe and front wheel', values: [toe(fa.toeClearance), toe(fb.toeClearance)], better: higher(fa.toeClearance, fb.toeClearance), link: 'r:toe' });
  }
  lines.push({ label: 'Wheelbase', values: [mm(a.frame.wheelbase), mm(b.frame.wheelbase)], better: null, link: 'f:wheelbase' });
  const wb = Math.round(b.frame.wheelbase - a.frame.wheelbase);
  const handling = wb >= 5 ? [', quicker steering', ', steadier steering'] : ['', ''];
  return {
    sizes: [a.size, b.size],
    lines,
    gist: [
      `${a.size} is the smaller, lower frame: ${mm(pa.spacers)} of spacers you can take out to go lower, more seatpost showing${handling[0]}.`,
      `${b.size} is the larger, taller frame: ${mm(up(b))} of spacers you can add to come up${handling[1]}.`,
    ],
  };
}
