import * as ed25519 from '@noble/ed25519';
import { DelegationManager } from './delegation-manager';
import type { IPFSManager } from './ipfs-manager';

function mockIPFS(): jest.Mocked<Pick<IPFSManager, 'storeDelegation' | 'updateIPNS'>> {
  return {
    storeDelegation: jest.fn().mockResolvedValue('QmTestCID'),
    updateIPNS: jest.fn().mockResolvedValue('/ipns/test')
  };
}

describe('DelegationManager', () => {
  let principalPrivateKey: Uint8Array;
  let principalPublicKey: Uint8Array;
  let agentPrivateKey: Uint8Array;
  let agentPublicKey: Uint8Array;

  beforeAll(async () => {
    principalPrivateKey = ed25519.utils.randomPrivateKey();
    principalPublicKey = await ed25519.getPublicKeyAsync(principalPrivateKey);
    agentPrivateKey = ed25519.utils.randomPrivateKey();
    agentPublicKey = await ed25519.getPublicKeyAsync(agentPrivateKey);
  });

  describe('createDelegation', () => {
    it('stores delegation on IPFS and returns CID', async () => {
      const ipfs = mockIPFS();
      const manager = new DelegationManager(ipfs as any, principalPrivateKey);

      const cid = await manager.createDelegation(agentPublicKey);

      expect(cid).toBe('QmTestCID');
      expect(ipfs.storeDelegation).toHaveBeenCalledTimes(1);
      expect(ipfs.updateIPNS).toHaveBeenCalledWith('QmTestCID');
    });

    it('creates delegation with correct fields', async () => {
      const ipfs = mockIPFS();
      const manager = new DelegationManager(ipfs as any, principalPrivateKey);

      await manager.createDelegation(agentPublicKey, 12);

      const stored = ipfs.storeDelegation.mock.calls[0][0];
      expect(stored.agent_id).toMatch(/^agent:ed25519:/);
      expect(stored.principal_id).toMatch(/^ed25519:/);
      expect(stored.issued_at).toBeTruthy();
      expect(stored.expires_at).toBeTruthy();
      expect(stored.delegation_signature).toBeTruthy();

      // Verify duration is ~12 hours
      const issued = new Date(stored.issued_at).getTime();
      const expires = new Date(stored.expires_at).getTime();
      expect(expires - issued).toBe(12 * 60 * 60 * 1000);
    });

    it('defaults to 24-hour duration', async () => {
      const ipfs = mockIPFS();
      const manager = new DelegationManager(ipfs as any, principalPrivateKey);

      await manager.createDelegation(agentPublicKey);

      const stored = ipfs.storeDelegation.mock.calls[0][0];
      const issued = new Date(stored.issued_at).getTime();
      const expires = new Date(stored.expires_at).getTime();
      expect(expires - issued).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('verifyDelegation', () => {
    it('verifies a delegation signed by the correct principal', async () => {
      const ipfs = mockIPFS();
      const manager = new DelegationManager(ipfs as any, principalPrivateKey);

      await manager.createDelegation(agentPublicKey);
      const delegation = ipfs.storeDelegation.mock.calls[0][0];

      const valid = await manager.verifyDelegation(delegation, principalPublicKey);
      expect(valid).toBe(true);
    });

    it('rejects delegation with wrong principal key', async () => {
      const ipfs = mockIPFS();
      const manager = new DelegationManager(ipfs as any, principalPrivateKey);

      await manager.createDelegation(agentPublicKey);
      const delegation = ipfs.storeDelegation.mock.calls[0][0];

      const wrongKey = await ed25519.getPublicKeyAsync(ed25519.utils.randomPrivateKey());
      const valid = await manager.verifyDelegation(delegation, wrongKey);
      expect(valid).toBe(false);
    });

    it('rejects delegation with tampered agent_id', async () => {
      const ipfs = mockIPFS();
      const manager = new DelegationManager(ipfs as any, principalPrivateKey);

      await manager.createDelegation(agentPublicKey);
      const delegation = { ...ipfs.storeDelegation.mock.calls[0][0] };
      delegation.agent_id = 'agent:ed25519:tampered';

      const valid = await manager.verifyDelegation(delegation, principalPublicKey);
      expect(valid).toBe(false);
    });

    it('rejects delegation with tampered expires_at', async () => {
      const ipfs = mockIPFS();
      const manager = new DelegationManager(ipfs as any, principalPrivateKey);

      await manager.createDelegation(agentPublicKey);
      const delegation = { ...ipfs.storeDelegation.mock.calls[0][0] };
      delegation.expires_at = '2099-12-31T23:59:59Z';

      const valid = await manager.verifyDelegation(delegation, principalPublicKey);
      expect(valid).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('returns false for future expiry', () => {
      const manager = new DelegationManager(mockIPFS() as any, principalPrivateKey);
      const delegation = {
        agent_id: 'agent:ed25519:test',
        principal_id: 'ed25519:test',
        issued_at: '2026-02-14T08:00:00Z',
        expires_at: '2099-12-31T23:59:59Z',
        delegation_signature: 'test'
      };
      expect(manager.isExpired(delegation)).toBe(false);
    });

    it('returns true for past expiry', () => {
      const manager = new DelegationManager(mockIPFS() as any, principalPrivateKey);
      const delegation = {
        agent_id: 'agent:ed25519:test',
        principal_id: 'ed25519:test',
        issued_at: '2020-01-01T00:00:00Z',
        expires_at: '2020-01-02T00:00:00Z',
        delegation_signature: 'test'
      };
      expect(manager.isExpired(delegation)).toBe(true);
    });
  });
});
