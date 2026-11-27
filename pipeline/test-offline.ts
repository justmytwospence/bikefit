import { Socket } from 'node:net';
import { Socket as DatagramSocket } from 'node:dgram';
import { afterAll, beforeAll, vi } from 'vitest';

/** Parser tests consume tracked responses, never the network. */
export function enforceOffline(): void {
  beforeAll(() => {
    vi.stubGlobal('fetch', () => { throw new Error('network disabled in parser tests'); });
    vi.spyOn(Socket.prototype, 'connect').mockImplementation(() => { throw new Error('network disabled in parser tests'); });
    vi.spyOn(DatagramSocket.prototype, 'send').mockImplementation(() => { throw new Error('network disabled in parser tests'); });
  });
  afterAll(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
}
