import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ValetConfig {
  ipfs: {
    repo: string;
    api: string;
    gateway: string;
  };
  delegation: {
    ipns_key: string;
    renewal_interval: number; // seconds
    auto_renew: boolean;
    max_violations: number;
  };
  agent: {
    private_key_path: string;
    agent_id?: string;
  };
  activity: {
    enabled: boolean;
    flush_interval: number; // seconds
    storage_key: string;
  };
}

const DEFAULT_CONFIG: ValetConfig = {
  ipfs: {
    repo: join(homedir(), '.valet', 'ipfs'),
    api: 'http://localhost:5001',
    gateway: 'http://localhost:8080'
  },
  delegation: {
    ipns_key: 'valet-delegations',
    renewal_interval: 86400, // 24 hours
    auto_renew: true,
    max_violations: 5
  },
  agent: {
    private_key_path: join(homedir(), '.valet', 'agent-key.pem')
  },
  activity: {
    enabled: true,
    flush_interval: 300, // 5 minutes
    storage_key: 'valet-activity'
  }
};

export class ConfigManager {
  private configPath: string;
  private config: ValetConfig;

  constructor(configPath?: string) {
    this.configPath = configPath || join(homedir(), '.valet', 'config.json');
    this.config = this.load();
  }

  private load(): ValetConfig {
    if (!existsSync(this.configPath)) {
      return this.createDefault();
    }

    try {
      const data = readFileSync(this.configPath, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (error) {
      console.error('Failed to load config, using defaults:', error);
      return DEFAULT_CONFIG;
    }
  }

  private createDefault(): ValetConfig {
    const valetDir = join(homedir(), '.valet');
    if (!existsSync(valetDir)) {
      mkdirSync(valetDir, { recursive: true });
    }

    this.save(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  save(config: ValetConfig): void {
    try {
      const dir = this.configPath.substring(0, this.configPath.lastIndexOf('/'));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
      this.config = config;
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  get(): ValetConfig {
    return { ...this.config };
  }

  update(updates: Partial<ValetConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      ipfs: { ...this.config.ipfs, ...updates.ipfs },
      delegation: { ...this.config.delegation, ...updates.delegation },
      agent: { ...this.config.agent, ...updates.agent },
      activity: { ...this.config.activity, ...updates.activity }
    };
    this.save(this.config);
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
