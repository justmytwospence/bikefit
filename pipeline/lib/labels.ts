import type { GeometryKey } from '../../src/data/schema';

export const LABELS: Record<GeometryKey, string[]> = {
  stack: ['stack', 'frame stack', 'stack height', 'stack hoehe', 'hauteur de cadre'],
  reach: ['reach', 'frame reach'],
  seatTubeAngle: [
    'seat tube angle', 'seat angle', 'effective seat tube angle', 'sitzrohrwinkel', 'angle du tube de selle',
    'angolo tubo sella', 'angulo tubo sillin', 'zitbuishoek',
  ],
  headTubeAngle: [
    'head tube angle', 'head angle', 'lenkwinkel', 'steuerrohrwinkel', 'angle de direction', 'angolo sterzo',
    'angulo direccion', 'balhoofdhoek',
  ],
  headTubeLength: [
    'head tube length', 'head tube', 'steuerrohrlange', 'longueur du tube de direction', 'lunghezza tubo sterzo',
    'longitud tubo direccion', 'balhoofdlengte',
  ],
  seatTubeLength: [
    'seat tube length', 'seat tube', 'seat tube c t', 'seat tube c c', 'sitzrohrlange', 'longueur du tube de selle',
    'lunghezza tubo sella', 'longitud tubo sillin', 'zitbuislengte',
  ],
  chainstay: [
    'chainstay length', 'chainstay', 'chain stay length', 'chain stay', 'kettenstrebenlange', 'longueur des bases',
    'lunghezza foderi orizzontali', 'longitud vainas', 'liggende achtervork',
  ],
  wheelbase: ['wheelbase', 'wheel base', 'radstand', 'empattement', 'interasse', 'distancia entre ejes', 'wielbasis'],
  bbDrop: [
    'bb drop', 'bottom bracket drop', 'tretlagerabsenkung', 'drop du boitier', 'abbassamento movimento centrale',
    'caida pedalier', 'bb verlaging',
  ],
};

const REJECT = [
  'effective stack', 'effective reach', 'with stem', 'cockpit', 'standover', 'stand over', 'top tube', 'bb height',
  'fork', 'trail',
];

export function normalizeLabel(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^\s*[a-z]{1,2}\s*[.)]\s+/, '')
    .replace(/^\s*[a-z]\s+-\s+/, '')
    .replace(/^\s*[a-z]\s+(?=[a-z])/, '')
    .replace(/\b(mm|cm|deg|degrees)\b|°/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ALL = (Object.entries(LABELS) as [GeometryKey, string[]][]).flatMap(([k, syns]) => syns.map((s) => [s, k] as const));

export function keyFor(label: string): GeometryKey | null {
  const n = normalizeLabel(label);
  if (!n) return null;
  if (REJECT.some((r) => n.includes(r))) return null;
  const exact = ALL.find(([s]) => s === n);
  if (exact) return exact[1];
  let best: readonly [string, GeometryKey] | null = null;
  for (const e of ALL) if (n.startsWith(e[0] + ' ') && (!best || e[0].length > best[0].length)) best = e;
  return best ? best[1] : null;
}
