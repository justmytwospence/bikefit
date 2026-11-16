import type { Frame } from '../model/types';

export type FrameCategory = 'race' | 'aero' | 'endurance' | 'gravel' | 'cyclocross';
export const CATEGORIES: { value: FrameCategory; label: string }[] = [
  { value: 'race', label: 'Race' },
  { value: 'aero', label: 'Aero' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'gravel', label: 'Gravel' },
  { value: 'cyclocross', label: 'Cyclocross' },
];
export const GEOMETRY_KEYS = [
  'stack', 'reach', 'seatTubeAngle', 'headTubeAngle', 'headTubeLength',
  'seatTubeLength', 'chainstay', 'wheelbase', 'bbDrop',
] as const;
export type GeometryKey = (typeof GEOMETRY_KEYS)[number];
export type CatalogSize = { size: string } & Record<GeometryKey, number>;

/** Shape of each src/data/frames/<brand>.json file. */
export interface BrandFile {
  brand: string;
  models: {
    model: string;
    year: number;
    category: FrameCategory;
    source: string;
    retrieved: string;
    aliases?: string[];
    tyreWidth?: number;
    maxSpacers?: number;
    estimated?: GeometryKey[];
    sizes: CatalogSize[];
  }[];
}

export interface CatalogModel {
  id: string;
  brand: string;
  model: string;
  year: number;
  category: FrameCategory;
  source: string;
  retrieved: string;
  aliases: string[];
  tyreWidth: number;
  maxSpacers: number;
  estimated: GeometryKey[];
  sizes: CatalogSize[];
}

export const CATEGORY_DEFAULTS: Record<FrameCategory, { tyreWidth: number; maxSpacers: number }> = {
  race: { tyreWidth: 28, maxSpacers: 30 },
  aero: { tyreWidth: 28, maxSpacers: 30 },
  endurance: { tyreWidth: 32, maxSpacers: 40 },
  gravel: { tyreWidth: 40, maxSpacers: 40 },
  cyclocross: { tyreWidth: 33, maxSpacers: 30 },
};

export function slug(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function buildCatalog(files: BrandFile[]): CatalogModel[] {
  const out: CatalogModel[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    for (const m of f.models) {
      const d = CATEGORY_DEFAULTS[m.category];
      const id = `${slug(f.brand)}-${slug(m.model)}-${m.year}`;
      if (seen.has(id)) throw new Error(`Duplicate catalog id: ${id}`);
      seen.add(id);
      out.push({
        id, brand: f.brand, model: m.model, year: m.year, category: m.category, source: m.source,
        retrieved: m.retrieved, aliases: m.aliases ?? [], tyreWidth: m.tyreWidth ?? d.tyreWidth,
        maxSpacers: m.maxSpacers ?? d.maxSpacers, estimated: m.estimated ?? [], sizes: m.sizes,
      });
    }
  }
  return out.sort((a, b) =>
    a.brand.localeCompare(b.brand, 'en') || a.model.localeCompare(b.model, 'en') || b.year - a.year);
}

export const frameId = (m: CatalogModel, size: string): string => `cat:${m.id}-${slug(size)}`;

export function toFrame(m: CatalogModel, s: CatalogSize): Frame {
  return {
    id: frameId(m, s.size),
    name: `${m.brand} ${m.model} ${m.year} · ${s.size}`,
    stack: s.stack, reach: s.reach, seatTubeAngle: s.seatTubeAngle, headTubeAngle: s.headTubeAngle,
    headTubeLength: s.headTubeLength, seatTubeLength: s.seatTubeLength, chainstay: s.chainstay,
    wheelbase: s.wheelbase, bbDrop: s.bbDrop, maxSpacers: m.maxSpacers, tyreWidth: m.tyreWidth,
  };
}

export function retrievedRange(models: CatalogModel[]): [string, string] {
  const d = models.map((m) => m.retrieved).sort();
  return [d[0] ?? '', d[d.length - 1] ?? ''];
}

const files = import.meta.glob<BrandFile>('./frames/*.json', { eager: true, import: 'default' });
export const CATALOG: CatalogModel[] = buildCatalog(Object.values(files));
