import * as ed25519 from '@noble/ed25519';
import { base58btc } from 'multiformats/bases/base58';
import { IPFSManager, type Delegation } from './ipfs-manager.js';

export class DelegationManager {
  constructor(
    private ipfsManager: IPFSManager,
    private principalPrivateKey: Uint8Array
  ) {}

  async createDelegation(agentPublicKey: Uint8Array, durationHours: number = 24): Promise<string> {
    const now = new Date();
    const expiry = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    const delegation: Delegation = {
      agent_id: this.formatAgentId(agentPublicKey),
      principal_id: await this.formatPrincipalId(
        await ed25519.getPublicKeyAsync(this.principalPrivateKey)
      ),
      issued_at: now.toISOString(),
      expires_at: expiry.toISOString(),
      delegation_signature: '' // Will fill after signing
    };

    // Sign the delegation
    const message = this.constructSignatureMessage(delegation);
    const signature = await ed25519.signAsync(message, this.principalPrivateKey);
    delegation.delegation_signature = this.toBase64(signature);

    // Store on IPFS
    const cid = await this.ipfsManager.storeDelegation(delegation);
    
    // Update IPNS pointer
    await this.ipfsManager.updateIPNS(cid);

    return cid;
  }

  async verifyDelegation(delegation: Delegation, principalPublicKey: Uint8Array): Promise<boolean> {
    try {
      // Reconstruct the message that was signed
      const message = this.constructSignatureMessage({
        ...delegation,
        delegation_signature: '' // Exclude signature from signed message
      });

      // Decode the signature
      const signature = this.fromBase64(delegation.delegation_signature);

      // Verify the signature
      return await ed25519.verifyAsync(signature, message, principalPublicKey);
    } catch (error) {
      console.error('Delegation verification failed:', error);
      return false;
    }
  }

  isExpired(delegation: Delegation): boolean {
    return new Date() >= new Date(delegation.expires_at);
  }

  private constructSignatureMessage(delegation: Omit<Delegation, 'delegation_signature'>): Uint8Array {
    const message = 
      delegation.agent_id + 
      delegation.issued_at + 
      delegation.expires_at;
    return new TextEncoder().encode(message);
  }

  private formatAgentId(publicKey: Uint8Array): string {
    const encoded = base58btc.encode(publicKey);
    return `agent:ed25519:${encoded.substring(1)}`; // Remove 'z' prefix from base58btc
  }

  private async formatPrincipalId(publicKey: Uint8Array): Promise<string> {
    const encoded = base58btc.encode(publicKey);
    return `ed25519:${encoded.substring(1)}`; // Remove 'z' prefix from base58btc
  }

  private toBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64');
  }

  private fromBase64(base64: string): Uint8Array {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
}
