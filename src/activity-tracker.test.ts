import { ActivityTracker } from './activity-tracker';
import type { IPFSManager } from './ipfs-manager';

function mockIPFS(): jest.Mocked<Pick<IPFSManager, 'storeJSON' | 'fetchJSON'>> {
  return {
    storeJSON: jest.fn().mockResolvedValue('QmTestCID123'),
    fetchJSON: jest.fn().mockResolvedValue([])
  };
}

describe('ActivityTracker', () => {
  describe('record', () => {
    it('buffers activity records', () => {
      const tracker = new ActivityTracker(mockIPFS() as any, 'agent:ed25519:test');

      tracker.record('api.example.com', 'GET', '/users', 200);
      tracker.record('api.example.com', 'POST', '/users', 201);

      expect(tracker.getBufferSize()).toBe(2);
    });

    it('defaults source to agent', () => {
      const ipfs = mockIPFS();
      const tracker = new ActivityTracker(ipfs as any, 'agent:ed25519:test');

      tracker.record('api.example.com', 'GET', '/test', 200);
      // Flush to inspect stored records
      tracker.flush();

      const storedRecords = ipfs.storeJSON.mock.calls[0][0] as any[];
      expect(storedRecords[0].source).toBe('agent');
    });

    it('accepts service as source', () => {
      const ipfs = mockIPFS();
      const tracker = new ActivityTracker(ipfs as any, 'agent:ed25519:test');

      tracker.record('api.example.com', 'GET', '/test', 200, 'service');
      tracker.flush();

      const storedRecords = ipfs.storeJSON.mock.calls[0][0] as any[];
      expect(storedRecords[0].source).toBe('service');
    });

    it('uppercases HTTP method', () => {
      const ipfs = mockIPFS();
      const tracker = new ActivityTracker(ipfs as any, 'agent:ed25519:test');

      tracker.record('api.example.com', 'get', '/test', 200);
      tracker.flush();

      const storedRecords = ipfs.storeJSON.mock.calls[0][0] as any[];
      expect(storedRecords[0].method).toBe('GET');
    });

    it('stamps agent_id on each record', () => {
      const ipfs = mockIPFS();
      const agentId = 'agent:ed25519:mykey123';
      const tracker = new ActivityTracker(ipfs as any, agentId);

      tracker.record('api.example.com', 'GET', '/test', 200);
      tracker.flush();

      const storedRecords = ipfs.storeJSON.mock.calls[0][0] as any[];
      expect(storedRecords[0].agent_id).toBe(agentId);
    });
  });

  describe('flush', () => {
    it('stores buffered records to IPFS and returns CID', async () => {
      const ipfs = mockIPFS();
      const tracker = new ActivityTracker(ipfs as any, 'agent:ed25519:test');

      tracker.record('api.example.com', 'GET', '/test', 200);
      const cid = await tracker.flush();

      expect(cid).toBe('QmTestCID123');
      expect(ipfs.storeJSON).toHaveBeenCalledTimes(1);
    });

    it('clears the buffer after flush', async () => {
      const tracker = new ActivityTracker(mockIPFS() as any, 'agent:ed25519:test');

      tracker.record('api.example.com', 'GET', '/test', 200);
      await tracker.flush();

      expect(tracker.getBufferSize()).toBe(0);
    });

    it('throws when buffer is empty', async () => {
      const tracker = new ActivityTracker(mockIPFS() as any, 'agent:ed25519:test');

      await expect(tracker.flush()).rejects.toThrow('No activity records to flush');
    });
  });

  describe('fetch', () => {
    it('delegates to IPFSManager.fetchJSON', async () => {
      const mockRecords = [
        { agent_id: 'test', timestamp: '2026-01-01T00:00:00Z', service: 'a.com', method: 'GET', path: '/', status: 200, source: 'agent' as const }
      ];
      const ipfs = mockIPFS();
      ipfs.fetchJSON.mockResolvedValue(mockRecords);

      const tracker = new ActivityTracker(ipfs as any, 'agent:ed25519:test');
      const records = await tracker.fetch('QmSomeCID');

      expect(ipfs.fetchJSON).toHaveBeenCalledWith('QmSomeCID');
      expect(records).toEqual(mockRecords);
    });
  });
});
