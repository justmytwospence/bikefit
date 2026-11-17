import type { CompareRow, FitProblem, FitResult } from '../model/optimize';
import type { Frame, ParamKey } from '../model/types';

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('../worker/optimize.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent) => {
    const { id, result, error } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (error) p.reject(new Error(error));
    else p.resolve(result);
  };
  w.onerror = (ev) => {
    const err = new Error(ev.message || 'Optimizer worker failed');
    for (const p of pending.values()) p.reject(err);
    pending.clear();
    w.terminate();
    worker = null;
  };
  worker = w;
  return w;
}

function call<T>(kind: 'optimize' | 'compare' | 'sizes', payload: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, kind, payload });
  });
}

export const runOptimize = (problem: FitProblem): Promise<FitResult> => call('optimize', problem);
export const runSizes = (problem: FitProblem, frames: Frame[]): Promise<CompareRow[]> =>
  call('sizes', { problem, frames });
export const runCompare = (
  problem: Omit<FitProblem, 'frame' | 'mode' | 'locks' | 'current'>,
  frames: Frame[],
): Promise<CompareRow[]> => call('compare', { problem, frames });

let pool: { workers: Worker[]; reject: (e: Error) => void } | null = null;

/** Runs compareFrames over many frames on a pool of workers, reporting rows as chunks finish. Best score first. */
export function runCatalog(
  problem: Omit<FitProblem, 'frame' | 'mode' | 'locks' | 'current'>, frames: Frame[],
  onChunk: (rows: CompareRow[], done: number) => void, locks: Partial<Record<ParamKey, boolean>> = {},
): Promise<CompareRow[]> {
  if (pool) {
    for (const w of pool.workers) w.terminate();
    pool.reject(new Error('Superseded'));
    pool = null;
  }
  if (!frames.length) return Promise.resolve([]);
  return new Promise<CompareRow[]>((resolve, reject) => {
    const n = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
    const chunks: Frame[][] = [];
    for (let i = 0; i < frames.length; i += 6) chunks.push(frames.slice(i, i + 6));
    const workers: Worker[] = [];
    const mine = { workers, reject };
    pool = mine;
    let next = 0;
    let finished = 0;
    let done = 0;
    let all: CompareRow[] = [];
    const stop = () => {
      for (const w of workers) w.terminate();
      if (pool === mine) pool = null;
    };
    const post = (w: Worker) => {
      if (next >= chunks.length) return;
      const i = next++;
      w.postMessage({ id: i, kind: 'compare', payload: { problem, frames: chunks[i], locks } });
    };
    for (let k = 0; k < Math.min(n, chunks.length); k++) {
      const w = new Worker(new URL('../worker/optimize.worker.ts', import.meta.url), { type: 'module' });
      workers.push(w);
      w.onmessage = (e: MessageEvent) => {
        const { id, result, error } = e.data;
        if (error) {
          stop();
          reject(new Error(error));
          return;
        }
        all = [...all, ...(result as CompareRow[])].sort((a, b) => a.result.cost - b.result.cost);
        done += chunks[id].length;
        finished++;
        onChunk([...all], done);
        if (finished === chunks.length) {
          stop();
          resolve(all);
        } else post(w);
      };
      w.onerror = (ev) => {
        stop();
        reject(new Error(ev.message || 'Optimizer worker failed'));
      };
      post(w);
    }
  });
}
