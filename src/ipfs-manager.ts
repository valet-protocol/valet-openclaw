import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';
import { CID } from 'multiformats/cid';
import type { Helia } from 'helia';
import type { UnixFS } from '@helia/unixfs';

export interface Delegation {
  agent_id: string;
  principal_id: string;
  issued_at: string;
  expires_at: string;
  delegation_signature: string;
}

export class IPFSManager {
  private helia: Helia | null = null;
  private fs: UnixFS | null = null;

  async init(): Promise<void> {
    this.helia = await createHelia();
    this.fs = unixfs(this.helia);
  }

  async storeDelegation(delegation: Delegation): Promise<string> {
    if (!this.fs) {
      throw new Error('IPFS not initialized. Call init() first.');
    }

    const encoder = new TextEncoder();
    const bytes = encoder.encode(JSON.stringify(delegation, null, 2));
    const cid = await this.fs.addBytes(bytes);
    
    return cid.toString();
  }

  async fetchDelegation(cidString: string): Promise<Delegation> {
    if (!this.fs) {
      throw new Error('IPFS not initialized. Call init() first.');
    }

    const cid = CID.parse(cidString);
    const decoder = new TextDecoder();
    let content = '';
    
    for await (const chunk of this.fs.cat(cid)) {
      content += decoder.decode(chunk, { stream: true });
    }
    
    return JSON.parse(content) as Delegation;
  }

  async updateIPNS(cidString: string, keyName: string = 'valet-delegations'): Promise<string> {
    if (!this.helia) {
      throw new Error('IPFS not initialized. Call init() first.');
    }

    const cid = CID.parse(cidString);
    
    // Publish CID to IPNS
    // Note: IPNS publishing requires additional setup in Helia
    // This is a simplified version - full implementation would use @helia/ipns
    
    console.log(`Publishing ${cidString} to IPNS name: ${keyName}`);
    
    // Return IPNS name (in practice, this would be the actual IPNS name)
    return `/ipns/${keyName}`;
  }

  async stop(): Promise<void> {
    if (this.helia) {
      await this.helia.stop();
      this.helia = null;
      this.fs = null;
    }
  }
}
