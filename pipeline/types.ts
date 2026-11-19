import type { BrandFile, FrameCategory, GeometryKey } from '../src/data/schema';

export interface Capture { url: string; timestamp: string; sha256: string }
/** `year` only orders the manifest; the build dates a page from what it states, its capture and `firstSeen`. */
export interface PageEntry extends Capture { family: string; year: number; related: Capture[]; firstSeen?: string }
/** pipeline/manifest/<file>.json */
export interface Manifest { brand: string; file: string; pages: PageEntry[] }
export interface Page { url: string; timestamp: string; html: string; related: Record<string, string> }
export type PartialSize = { size: string } & Partial<Record<GeometryKey, number>>;
export interface Extracted {
  model: string;
  /** The model year the page states, when it states one. */
  year?: number;
  category: FrameCategory;
  sizes: PartialSize[];
  tyreWidth?: number;
  aliases?: string[];
}
export interface Adapter {
  brand: string;
  file: string;
  /** CDX prefixes, scheme-less, matched with matchType=prefix. */
  prefixes: string[];
  /** Live listing or product URLs to Save-Page-Now when they have no capture since 2026-01-01. */
  seeds: string[];
  /** Canonical URL and family key for a captured URL, or null to ignore it (non drop-bar, e-bike, listings). */
  accept(url: string): { url: string; family: string } | null;
  /** Extra URLs a page needs (for example a geometry endpoint), pinned with the page. */
  related?(html: string, url: string): string[];
  /** Pure: geometry on this page. Empty when there is none. */
  extract(page: Page): Extracted[];
}
export interface Overrides {
  /** Hand-entered models, emitted only when no extracted model came from their source URL. */
  manual: BrandFile['models'];
  /** Page URLs to skip. */
  exclude: string[];
  /** Model name as extracted to fixes. */
  models: Record<string, { model?: string; category?: FrameCategory; tyreWidth?: number; maxSpacers?: number; aliases?: string[]; drop?: boolean }>;
  /**
   * Years the pinned pages cannot show. The built model of this name whose `size` has this stack and reach gets
   * `year`, and `lastYear` when given; `note` says where the years come from and is not read by the build.
   */
  years?: { model: string; size: string; stack: number; reach: number; year: number; lastYear?: number; note: string }[];
}
