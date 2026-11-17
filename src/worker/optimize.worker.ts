import { compareFrames, optimizeFit, optimizeSizes } from '../model/optimize';

self.onmessage = (e: MessageEvent) => {
  const { id, kind, payload } = e.data;
  try {
    const result = kind === 'optimize'
      ? optimizeFit(payload)
      : kind === 'sizes'
        ? optimizeSizes(payload.problem, payload.frames)
        : compareFrames(payload.problem, payload.frames, payload.locks);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
