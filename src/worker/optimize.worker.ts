import { compareFrames, optimizeFit } from '../model/optimize';

self.onmessage = (e: MessageEvent) => {
  const { id, kind, payload } = e.data;
  try {
    const result = kind === 'optimize' ? optimizeFit(payload) : compareFrames(payload.problem, payload.frames);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
