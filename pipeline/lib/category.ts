import type { FrameCategory } from '../../src/data/schema';

/** The first rule whose pattern matches the text decides the category. */
export function categoryFrom(text: string, rules: [RegExp, FrameCategory][], fallback: FrameCategory): FrameCategory {
  for (const [re, c] of rules) if (re.test(text)) return c;
  return fallback;
}
