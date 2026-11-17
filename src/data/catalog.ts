import { buildCatalog, type BrandFile, type CatalogModel } from './schema';

export * from './schema';

const files = import.meta.glob<BrandFile>('./frames/*.json', { eager: true, import: 'default' });
export const CATALOG: CatalogModel[] = buildCatalog(Object.values(files));
