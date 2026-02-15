import * as ed25519 from '@noble/ed25519';
import { base58btc } from 'multiformats/bases/base58';
import type { Delegation } from './ipfs-manager.js';

export interface SignedRequest {
  headers: {
    'VALET-Authorization': string;
    'VALET-Agent': string;
    'Signature-Input': string;
    'Signature': string;
  };
}

export class RequestSigner {
  private agentPublicKey: Uint8Array | null = null;

  constructor(private agentPrivateKey: Uint8Array) {}

  async signRequest(
    method: string,
    path: string,
    delegation: Delegation,
    recordUrl: string,
    body?: string
  ): Promise<SignedRequest> {
    const created = Math.floor(Date.now() / 1000);
    const agentId = await this.getAgentId();

    // Base64-encode the delegation JSON per spec Section 5.1
    const valetAuthorization = Buffer.from(JSON.stringify(delegation)).toString('base64');

    // Construct signature base per RFC 9421
    const signatureBase = this.constructSignatureBase(
      method,
      path,
      valetAuthorization,
      created,
      agentId
    );

    // Sign the signature base
    const signature = await ed25519.signAsync(
      new TextEncoder().encode(signatureBase),
      this.agentPrivateKey
    );

    // Format headers per RFC 9421 and VALET spec
    const signatureInput =
      `valet=("@method" "@path" "valet-authorization");` +
      `created=${created};` +
      `keyid="${agentId}";` +
      `alg="ed25519";` +
      `v="1.0"`;

    const signatureValue = `valet=:${this.toBase64(signature)}:`;

    return {
      headers: {
        'VALET-Authorization': valetAuthorization,
        'VALET-Agent': `record=${recordUrl}`,
        'Signature-Input': signatureInput,
        'Signature': signatureValue
      }
    };
  }

  async verifyRequest(
    method: string,
    path: string,
    valetAuthorization: string,
    signatureInput: string,
    signatureValue: string
  ): Promise<boolean> {
    try {
      // Parse signature input to extract parameters
      const params = this.parseSignatureInput(signatureInput);
      if (!params) return false;

      // Reconstruct signature base
      const signatureBase = this.constructSignatureBase(
        method,
        path,
        valetAuthorization,
        params.created,
        params.keyid
      );

      // Extract signature from signature value
      const sigMatch = signatureValue.match(/valet=:([^:]+):/);
      if (!sigMatch) return false;

      const signature = this.fromBase64(sigMatch[1]);

      // Get public key from keyid
      const publicKey = this.extractPublicKeyFromAgentId(params.keyid);

      // Verify signature
      return await ed25519.verifyAsync(
        signature,
        new TextEncoder().encode(signatureBase),
        publicKey
      );
    } catch (error) {
      console.error('Request verification failed:', error);
      return false;
    }
  }

  private constructSignatureBase(
    method: string,
    path: string,
    valetAuthorization: string,
    created: number,
    agentId: string
  ): string {
    // Per RFC 9421, each component is on its own line
    return [
      `"@method": ${method}`,
      `"@path": ${path}`,
      `"valet-authorization": ${valetAuthorization}`,
      `"@signature-params": ("@method" "@path" "valet-authorization");` +
      `created=${created};keyid="${agentId}";alg="ed25519";v="1.0"`
    ].join('\n');
  }

  private async getAgentId(): Promise<string> {
    if (!this.agentPublicKey) {
      this.agentPublicKey = await ed25519.getPublicKeyAsync(this.agentPrivateKey);
    }
    const encoded = base58btc.encode(this.agentPublicKey);
    return `agent:ed25519:${encoded.substring(1)}`; // Remove 'z' prefix
  }

  private parseSignatureInput(input: string): { created: number; keyid: string } | null {
    const createdMatch = input.match(/created=(\d+)/);
    const keyidMatch = input.match(/keyid="([^"]+)"/);

    if (!createdMatch || !keyidMatch) return null;

    return {
      created: parseInt(createdMatch[1]),
      keyid: keyidMatch[1]
    };
  }

  private extractPublicKeyFromAgentId(agentId: string): Uint8Array {
    // Format: agent:ed25519:BASE58_PUBKEY
    const parts = agentId.split(':');
    if (parts.length !== 3 || parts[0] !== 'agent' || parts[1] !== 'ed25519') {
      throw new Error('Invalid agent ID format');
    }

    // Add back the 'z' prefix for base58btc decoding
    const decoded = base58btc.decode('z' + parts[2]);
    return decoded;
  }

  private toBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64');
  }

  private fromBase64(base64: string): Uint8Array {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
}
