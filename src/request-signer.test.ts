import * as ed25519 from '@noble/ed25519';
import { RequestSigner } from './request-signer';
import type { Delegation } from './ipfs-manager';

describe('RequestSigner', () => {
  let agentPrivateKey: Uint8Array;
  let signer: RequestSigner;

  const delegation: Delegation = {
    agent_id: 'agent:ed25519:testkey',
    principal_id: 'ed25519:principalkey',
    issued_at: '2026-02-14T08:00:00Z',
    expires_at: '2026-02-15T08:00:00Z',
    delegation_signature: 'dGVzdHNpZw=='
  };

  const recordUrl = 'https://ipfs.io/ipfs/QmTestCID';

  beforeAll(async () => {
    agentPrivateKey = ed25519.utils.randomPrivateKey();
    signer = new RequestSigner(agentPrivateKey);
  });

  describe('signRequest', () => {
    it('returns all four required VALET headers', async () => {
      const result = await signer.signRequest('POST', '/api/test', delegation, recordUrl);

      expect(result.headers).toHaveProperty('VALET-Authorization');
      expect(result.headers).toHaveProperty('VALET-Agent');
      expect(result.headers).toHaveProperty('Signature-Input');
      expect(result.headers).toHaveProperty('Signature');
    });

    it('base64-encodes delegation JSON in VALET-Authorization', async () => {
      const result = await signer.signRequest('POST', '/api/test', delegation, recordUrl);

      const decoded = JSON.parse(Buffer.from(result.headers['VALET-Authorization'], 'base64').toString());
      expect(decoded).toEqual(delegation);
    });

    it('sets VALET-Agent with record= prefix', async () => {
      const result = await signer.signRequest('POST', '/api/test', delegation, recordUrl);

      expect(result.headers['VALET-Agent']).toBe(`record=${recordUrl}`);
    });

    it('includes valet label, covered components, and v=1.0 in Signature-Input', async () => {
      const result = await signer.signRequest('POST', '/api/test', delegation, recordUrl);
      const sigInput = result.headers['Signature-Input'];

      expect(sigInput).toMatch(/^valet=\(/);
      expect(sigInput).toContain('"@method"');
      expect(sigInput).toContain('"@path"');
      expect(sigInput).toContain('"valet-authorization"');
      expect(sigInput).toContain('alg="ed25519"');
      expect(sigInput).toContain('v="1.0"');
      expect(sigInput).toMatch(/created=\d+/);
      expect(sigInput).toMatch(/keyid="agent:ed25519:[^"]+"/);
    });

    it('wraps signature in valet=:...: format', async () => {
      const result = await signer.signRequest('POST', '/api/test', delegation, recordUrl);

      expect(result.headers['Signature']).toMatch(/^valet=:[A-Za-z0-9+/=]+:$/);
    });
  });

  describe('signRequest + verifyRequest round-trip', () => {
    it('verifies a request signed by the same key', async () => {
      const result = await signer.signRequest('GET', '/api/data', delegation, recordUrl);

      const valid = await signer.verifyRequest(
        'GET',
        '/api/data',
        result.headers['VALET-Authorization'],
        result.headers['Signature-Input'],
        result.headers['Signature']
      );

      expect(valid).toBe(true);
    });

    it('rejects when method is tampered', async () => {
      const result = await signer.signRequest('GET', '/api/data', delegation, recordUrl);

      const valid = await signer.verifyRequest(
        'POST', // tampered
        '/api/data',
        result.headers['VALET-Authorization'],
        result.headers['Signature-Input'],
        result.headers['Signature']
      );

      expect(valid).toBe(false);
    });

    it('rejects when path is tampered', async () => {
      const result = await signer.signRequest('GET', '/api/data', delegation, recordUrl);

      const valid = await signer.verifyRequest(
        'GET',
        '/api/evil', // tampered
        result.headers['VALET-Authorization'],
        result.headers['Signature-Input'],
        result.headers['Signature']
      );

      expect(valid).toBe(false);
    });

    it('rejects when authorization header is tampered', async () => {
      const result = await signer.signRequest('GET', '/api/data', delegation, recordUrl);

      const valid = await signer.verifyRequest(
        'GET',
        '/api/data',
        'dGFtcGVyZWQ=', // tampered
        result.headers['Signature-Input'],
        result.headers['Signature']
      );

      expect(valid).toBe(false);
    });

    it('verifies using keyid from Signature-Input, not the verifier key', async () => {
      // verifyRequest extracts the public key from keyid in Signature-Input.
      // A request signed by another key will verify successfully because the
      // keyid matches the signer. The actual authorization check (is this agent
      // allowed?) happens at the delegation verification layer, not here.
      const otherKey = ed25519.utils.randomPrivateKey();
      const otherSigner = new RequestSigner(otherKey);

      const result = await otherSigner.signRequest('GET', '/api/data', delegation, recordUrl);

      // The signature is valid for the keyid embedded in Signature-Input
      const valid = await otherSigner.verifyRequest(
        'GET',
        '/api/data',
        result.headers['VALET-Authorization'],
        result.headers['Signature-Input'],
        result.headers['Signature']
      );
      expect(valid).toBe(true);

      // But if we swap the signature (keep otherSigner's Signature-Input but
      // use original signer's Signature), verification fails — keyid mismatch
      const originalResult = await signer.signRequest('GET', '/api/data', delegation, recordUrl);
      const crossValid = await signer.verifyRequest(
        'GET',
        '/api/data',
        result.headers['VALET-Authorization'],
        result.headers['Signature-Input'],    // otherSigner's keyid
        originalResult.headers['Signature']    // original signer's signature
      );
      expect(crossValid).toBe(false);
    });
  });

  describe('verifyRequest edge cases', () => {
    it('returns false for malformed Signature-Input', async () => {
      const valid = await signer.verifyRequest(
        'GET', '/api/data', 'dGVzdA==', 'garbage', 'valet=:abc:'
      );
      expect(valid).toBe(false);
    });

    it('returns false for malformed Signature value', async () => {
      const result = await signer.signRequest('GET', '/api/data', delegation, recordUrl);

      const valid = await signer.verifyRequest(
        'GET',
        '/api/data',
        result.headers['VALET-Authorization'],
        result.headers['Signature-Input'],
        'not-a-valid-signature'
      );

      expect(valid).toBe(false);
    });
  });
});
