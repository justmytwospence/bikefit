import { buildCatalog, type BrandFile, type CatalogSize } from './catalog';

const sz = (size: string, stack: number, reach: number): CatalogSize => ({
  size, stack, reach, seatTubeAngle: 73.5, headTubeAngle: 73, headTubeLength: 140,
  seatTubeLength: 520, chainstay: 410, wheelbase: 990, bbDrop: 72,
});
const row = (labels: string[]) => labels.map((l, i) => sz(l, 520 + i * 20, 370 + i * 8));
const base = { retrieved: '2026-11-16' };

export const FIXTURE_FILES: BrandFile[] = [
  {
    brand: 'Specialized',
    models: [
      { ...base, model: 'Tarmac SL8', year: 2024, category: 'race', source: 'https://example.com/a', aliases: ['SL8'], sizes: row(['49', '52', '54', '56', '58', '61']) },
      { ...base, model: 'Diverge', year: 2025, category: 'gravel', source: 'https://example.com/b', tyreWidth: 47, sizes: row(['S', 'M', 'L']) },
    ],
  },
  { brand: 'Trek', models: [{ ...base, model: 'Émonda SLR', year: 2021, category: 'race', source: 'https://example.com/c', sizes: row(['52', '54', '56']) }] },
  { brand: 'Cervélo', models: [{ ...base, model: 'Áspero', year: 2023, category: 'gravel', source: 'https://example.com/d', sizes: row(['51', '54', '56']) }] },
  { brand: 'Giant', models: [{ ...base, model: 'Revolt', year: 2025, category: 'gravel', source: 'https://example.com/e', sizes: row(['S', 'M', 'L']) }] },
];
export const FIXTURE = buildCatalog(FIXTURE_FILES);
