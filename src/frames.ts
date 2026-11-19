import { bikeOf, event, sizeOf } from './lib/analytics';
import type { Frame } from './model/types';
import { activeFrame, app, clearFeedback } from './state.svelte';

export function selectFrame(id: string) {
  app.activeFrameId = id;
  clearFeedback();
}

export function duplicateFrame() {
  const f = structuredClone(activeFrame());
  f.id = crypto.randomUUID();
  f.name = f.name + ' copy';
  app.frames.push(f);
  app.activeFrameId = f.id;
}

/** A frame of your own to type geometry into, starting from the current frame's numbers. */
export function newFrame() {
  const f = structuredClone(activeFrame());
  f.id = crypto.randomUUID();
  f.name = 'My frame';
  app.frames.push(f);
  app.activeFrameId = f.id;
}

export function deleteFrame(id: string) {
  if (app.frames.length <= 1) return;
  const i = app.frames.findIndex((f) => f.id === id);
  if (i < 0) return;
  const [gone] = app.frames.splice(i, 1);
  if (app.activeFrameId !== id) return;
  // Deleting one size of a catalog model stays on that model when another size is saved.
  const cut = gone.name.lastIndexOf(' · ');
  const model = gone.id.startsWith('cat:') && cut >= 0 ? gone.name.slice(0, cut + 3) : null;
  const sibling = model ? app.frames.find((f) => f.id.startsWith('cat:') && f.name.startsWith(model)) : undefined;
  app.activeFrameId = (sibling ?? app.frames[Math.min(i, app.frames.length - 1)]).id;
  clearFeedback();
}

export function addCatalogFrame(f: Frame) {
  event('Frame chosen', { bike: bikeOf(f.id, f.name), size: sizeOf(f.name) });
  if (!app.frames.some((x) => x.id === f.id)) app.frames.push(structuredClone(f));
  app.activeFrameId = f.id;
  clearFeedback();
}

/** Saves every given frame not already saved; returns how many were new. Keeps the active frame. */
export function addCatalogModel(frames: Frame[]): number {
  let n = 0;
  for (const f of frames) {
    if (app.frames.some((x) => x.id === f.id)) continue;
    app.frames.push(structuredClone(f));
    n++;
  }
  return n;
}
