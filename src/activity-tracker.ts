import { IPFSManager } from './ipfs-manager.js';

export interface ActivityRecord {
  agent_id: string;
  timestamp: string;
  service: string;
  method: string;
  path: string;
  status: number;
  source: 'agent' | 'service';
}

export class ActivityTracker {
  private buffer: ActivityRecord[] = [];

  constructor(
    private ipfsManager: IPFSManager,
    private agentId: string
  ) {}

  record(
    service: string,
    method: string,
    path: string,
    status: number,
    source: 'agent' | 'service' = 'agent'
  ): void {
    this.buffer.push({
      agent_id: this.agentId,
      timestamp: new Date().toISOString(),
      service,
      method: method.toUpperCase(),
      path,
      status,
      source
    });
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  async flush(): Promise<string> {
    if (this.buffer.length === 0) {
      throw new Error('No activity records to flush');
    }

    const records = [...this.buffer];
    const cid = await this.ipfsManager.storeJSON(records);

    this.buffer = [];
    return cid;
  }

  async fetch(cidString: string): Promise<ActivityRecord[]> {
    return this.ipfsManager.fetchJSON<ActivityRecord[]>(cidString);
  }
}
