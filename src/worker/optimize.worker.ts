import type { Frame } from '../model/types';
import { walkSizes } from '../lib/sizeWalk';
import { compareFrames, optimizeFit, optimizeSizes } from '../model/optimize';

self.onmessage = (e: MessageEvent) => {
  const { id, kind, payload } = e.data;
  try {
    const result = kind === 'optimize'
      ? optimizeFit(payload)
      : kind === 'walk'
        ? payload.jobs.flatMap((j: { frames: Frame[]; start: number }) =>
            walkSizes(j.frames.length, j.start, (i) => compareFrames(payload.problem, [j.frames[i]], payload.locks)[0]))
      : kind === 'sizes'
        ? optimizeSizes(payload.problem, payload.frames)
        : compareFrames(payload.problem, payload.frames, payload.locks);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
