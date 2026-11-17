import type { CompareRow, FitProblem, FitResult } from '../model/optimize';
import type { Frame } from '../model/types';

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
