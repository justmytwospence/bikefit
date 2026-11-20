import type { Frame } from '../model/types';
import { nearStems } from '../lib/catalogFit';
import { walkSizes } from '../lib/sizeWalk';
import { compareFrames, optimizeFit } from '../model/optimize';

self.onmessage = (e: MessageEvent) => {
  const { id, kind, payload } = e.data;
  try {
    const result = kind === 'optimize'
      ? optimizeFit(payload)
      : kind === 'walk'
        ? payload.jobs.flatMap((j: { frames: Frame[]; start: number }) =>
            walkSizes(j.frames.length, j.start, (i) => {
              const f = j.frames[i];
              const options = { ...payload.problem.options, ...nearStems(f, payload.problem.components, payload.problem.options, payload.idealHoods) };
              return compareFrames({ ...payload.problem, options }, [f], payload.locks)[0];
            }))
      : compareFrames(payload.problem, payload.frames, payload.locks);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
