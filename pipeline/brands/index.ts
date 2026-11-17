import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Adapter } from '../types';
import { noGeometry } from './none';

const here = dirname(fileURLToPath(import.meta.url));

/** The adapter for a brand file, or a manual-only adapter when it has none. */
export async function adapterFor(file: string, brand: string): Promise<Adapter> {
  const present = readdirSync(here).includes(`${file}.ts`);
  if (!present) return noGeometry(file, brand);
  const mod = (await import(join(here, `${file}.ts`))) as { default: Adapter };
  return mod.default;
}
