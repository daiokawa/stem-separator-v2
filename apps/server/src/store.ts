import IORedis from 'ioredis';
import type { JobSnapshot } from './events.js';

export interface JobStore {
  get(id: string): Promise<JobSnapshot | null>;
  set(id: string, snap: JobSnapshot, ttlSec?: number): Promise<void>;
}

class MemoryJobStore implements JobStore {
  private m = new Map<string, JobSnapshot>();
  async get(id: string) {
    return this.m.get(id) ?? null;
  }
  async set(id: string, snap: JobSnapshot) {
    this.m.set(id, snap);
  }
}

class RedisJobStore implements JobStore {
  constructor(private redis: IORedis, private keyPrefix = 'job:') {}
  async get(id: string) {
    const key = this.keyPrefix + id;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as JobSnapshot;
    } catch {
      return null;
    }
  }
  async set(id: string, snap: JobSnapshot, ttlSec = 7 * 24 * 3600) {
    const key = this.keyPrefix + id;
    await this.redis.set(key, JSON.stringify(snap), 'EX', ttlSec);
  }
}

export function createStore(): { store: JobStore; redis?: IORedis } {
  const url = process.env.REDIS_URL;
  if (!url) {
    return { store: new MemoryJobStore() };
  }
  const redis = new IORedis(url, { lazyConnect: true });
  // connect in background
  redis.connect().catch((e) => console.error('[redis] connect error', e));
  return { store: new RedisJobStore(redis), redis };
}

