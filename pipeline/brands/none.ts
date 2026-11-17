import type { Adapter } from '../types';

/** A brand with no machine-readable geometry (or no adapter yet): only its hand-entered models are emitted. */
export const noGeometry = (file: string, brand: string): Adapter => ({
  brand, file, prefixes: [], seeds: [], accept: () => null, extract: () => [],
});
