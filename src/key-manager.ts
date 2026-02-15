import * as ed25519 from '@noble/ed25519';
import { base58btc } from 'multiformats/bases/base58';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export class KeyManager {
  async generate(): Promise<KeyPair> {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = await ed25519.getPublicKeyAsync(privateKey);
    return { privateKey, publicKey };
  }

  async loadOrGenerate(path: string): Promise<KeyPair> {
    if (existsSync(path)) {
      return this.load(path);
    }

    const keyPair = await this.generate();
    this.save(path, keyPair.privateKey);
    return keyPair;
  }

  async load(path: string): Promise<KeyPair> {
    if (!existsSync(path)) {
      throw new Error(`Key file not found: ${path}`);
    }

    const hex = readFileSync(path, 'utf-8').trim();
    const privateKey = Uint8Array.from(Buffer.from(hex, 'hex'));
    const publicKey = await ed25519.getPublicKeyAsync(privateKey);
    return { privateKey, publicKey };
  }

  save(path: string, privateKey: Uint8Array): void {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const hex = Buffer.from(privateKey).toString('hex');
    writeFileSync(path, hex, { mode: 0o600 });
  }

  agentIdFromPublicKey(publicKey: Uint8Array): string {
    const encoded = base58btc.encode(publicKey);
    return `agent:ed25519:${encoded.substring(1)}`;
  }

  principalIdFromPublicKey(publicKey: Uint8Array): string {
    const encoded = base58btc.encode(publicKey);
    return `ed25519:${encoded.substring(1)}`;
  }
}
