import { Queue, Worker } from 'bullmq';
import type { JobSnapshot } from './events.js';
import { createStore } from './store.js';

const { redis, store } = createStore();

export type EnqueuePayload = {
  jobId: string;
  fileKey: string;
  size?: number;
  mime?: string;
};

export let separationQueue: Queue | undefined;
export let separationWorker: Worker | undefined;

if (redis) {
  separationQueue = new Queue('separation', {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  // Minimal worker: mark as processing and wait for webhooks to drive progress
  separationWorker = new Worker(
    'separation',
    async (job: any) => {
      const now = new Date().toISOString();
      const snap: JobSnapshot = {
        jobId: job.data.jobId as string,
        status: 'processing',
        stage: 'preprocess',
        progress: 1,
        version: 2,
        updatedAt: now,
      };
      await store.set(job.data.jobId, snap);
      // In real impl: trigger Modal.com job start here.
    },
    { connection: redis, concurrency: 2 }
  );

  separationWorker.on('failed', (job, err) => {
    console.error('[worker] failed', job?.id, err?.message);
  });
}

export async function enqueueSeparationJob(payload: EnqueuePayload) {
  if (!separationQueue) return; // no redis → skip queueing
  await separationQueue.add('start', payload as any);
}
