// Local copy for web build stability on Vercel

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type JobStage = 'preprocess' | 'separate' | 'postprocess' | 'upload';

export interface JobFiles {
  drums?: string;
  bass?: string;
  vocals?: string;
  other?: string;
  zip?: string;
}

export interface JobSnapshot {
  jobId: string;
  status: JobStatus;
  stage?: JobStage;
  progress: number; // 0..100
  etaSec?: number;
  files?: JobFiles;
  version: number; // monotonic increasing
  updatedAt: string; // ISO string
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}

export interface JobAcceptedPayload {
  jobId: string;
  queuedAt: string;
}

export interface JobProgressPayload {
  jobId: string;
  stage: JobStage;
  progress: number; // 0..100
  etaSec?: number;
  version: number;
  ts: string;
}

export interface JobSnapshotPayload extends JobSnapshot {}

export interface JobCompletePayload {
  jobId: string;
  files: JobFiles;
  version: number;
  ts: string;
}

export interface JobErrorPayload {
  jobId: string;
  code: string;
  message: string;
  retryable?: boolean;
  version: number;
  ts: string;
}

export const Events = {
  Accepted: 'job:accepted',
  Progress: 'job:progress',
  Snapshot: 'job:snapshot',
  Complete: 'job:complete',
  Error: 'job:error',
} as const;

export type EventName = typeof Events[keyof typeof Events];

