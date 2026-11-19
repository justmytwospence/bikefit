import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bikeOf, connect, event, eventOnce, reportError, resetAnalytics, scrubUrl, searchLogger, sizeOf,
} from './analytics';

describe('analytics', () => {
  beforeEach(() => resetAnalytics());
  afterEach(() => vi.useRealTimers());

  it('queues events until connected, then sends them in order', () => {
    event('A', { x: 1 });
    event('B');
    const spy = vi.fn();
    connect(spy);
    expect(spy.mock.calls).toEqual([['A', { x: 1 }], ['B', undefined]]);
    event('C');
    expect(spy).toHaveBeenLastCalledWith('C', undefined);
  });

  it('drops events past 50 while not connected', () => {
    for (let i = 0; i < 60; i++) event('E', { i });
    const spy = vi.fn();
    connect(spy);
    expect(spy).toHaveBeenCalledTimes(50);
  });

  it('cuts long strings to 120 characters', () => {
    const spy = vi.fn();
    connect(spy);
    event('Long', { q: 'x'.repeat(300), n: 5 });
    expect(spy.mock.calls[0][1].q).toHaveLength(120);
    expect(spy.mock.calls[0][1].n).toBe(5);
  });

  it('eventOnce sends a name and properties once', () => {
    const spy = vi.fn();
    connect(spy);
    eventOnce('M', { field: 'thigh' });
    eventOnce('M', { field: 'thigh' });
    eventOnce('M', { field: 'shank' });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('reportError stops after five and ignores Superseded', () => {
    const spy = vi.fn();
    connect(spy);
    reportError('catalog', new Error('Superseded'));
    expect(spy).not.toHaveBeenCalled();
    for (let i = 0; i < 8; i++) reportError('x', new Error(`e${i}`));
    expect(spy).toHaveBeenCalledTimes(5);
    expect(spy).toHaveBeenCalledWith('Error', { where: 'x', message: 'e0' });
  });

  it('scrubUrl removes the hash and keeps the query', () => {
    expect(scrubUrl('https://bikefitter.app/?utm_source=reddit#d=abc')).toBe('https://bikefitter.app/?utm_source=reddit');
  });

  it('bikeOf names catalog bikes without the size and hides custom frames', () => {
    expect(bikeOf('cat:x', 'Specialized Tarmac SL8 2024 · 56')).toBe('Specialized Tarmac SL8 2024');
    expect(bikeOf('f123', 'My steel bike')).toBe('custom');
    expect(sizeOf('Specialized Tarmac SL8 2024 · 56')).toBe('56');
    expect(sizeOf('My steel bike')).toBe('');
  });

  it('searchLogger waits, sends the last query once, skips short and repeated queries', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    connect(spy);
    const log = searchLogger(1000);
    log('t', 3);
    log('Tar', 10);
    log(' Tarmac ', 4);
    vi.advanceTimersByTime(999);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy.mock.calls).toEqual([['Bike search', { query: 'tarmac', results: 4 }]]);
    log('tarmac', 4);
    vi.advanceTimersByTime(1000);
    log('x', 0);
    vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
