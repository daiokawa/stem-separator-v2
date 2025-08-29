// WebSocketイベント契約の型定義

export type JobStage = 'queued' | 'preprocess' | 'separate' | 'postprocess' | 'complete' | 'error'

export interface JobProgress {
  jobId: string
  stage: JobStage
  progress: number // 0-100
  etaSec?: number
  message?: string
  version: number
  ts: number
}

export interface JobSnapshot extends JobProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  files?: StemFiles
  error?: JobError
}

export interface JobComplete {
  jobId: string
  files: StemFiles
  ts: number
}

export interface JobError {
  jobId: string
  code: string
  message: string
  retryable: boolean
  ts: number
}

export interface StemFiles {
  drums?: string
  bass?: string
  vocals?: string
  other?: string
  zip?: string
}

// WebSocketイベント名の定義
export const WS_EVENTS = {
  // サーバー → クライアント
  JOB_ACCEPTED: 'job:accepted',
  JOB_PROGRESS: 'job:progress',
  JOB_SNAPSHOT: 'job:snapshot',
  JOB_COMPLETE: 'job:complete',
  JOB_ERROR: 'job:error',
  
  // クライアント → サーバー
  JOIN_JOB: 'job:join',
  LEAVE_JOB: 'job:leave',
  REQUEST_SNAPSHOT: 'job:request-snapshot'
} as const

// APIレスポンス型
export interface UploadStartResponse {
  uploadUrl: string
  uploadId: string
}

export interface UploadCompleteRequest {
  uploadId: string
  fileName: string
  fileSize: number
  mimeType: string
}

export interface UploadCompleteResponse {
  jobId: string
  queuedAt: string
}

export interface JobStatusResponse {
  jobId: string
  status: JobSnapshot['status']
  stage: JobStage
  progress: number
  files?: StemFiles
  error?: JobError
}

// Webhook payload (Modal.com → Backend)
export interface WebhookPayload {
  jobId: string
  event: 'progress' | 'complete' | 'error'
  data: {
    stage?: JobStage
    progress?: number
    message?: string
    files?: StemFiles
    error?: string
  }
  timestamp: number
  signature?: string
}