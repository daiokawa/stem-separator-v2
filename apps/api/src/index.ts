import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Server } from 'socket.io'
import { createServer } from 'http'
import Redis from 'ioredis'
import { Queue, Worker, QueueEvents } from 'bullmq'
import { WS_EVENTS, type JobProgress, type JobSnapshot } from '@stem/types'
import { setupUploadRoutes } from './routes/upload'
import { setupWebhookRoutes } from './routes/webhook'
import { setupJobRoutes } from './routes/job'
import { config } from './config'

// Hono app
const app = new Hono()
app.use('*', cors())

// Health check
app.get('/health', (c) => c.json({ ok: true, timestamp: Date.now() }))

// Redis connection
export const redis = new Redis(config.REDIS_URL)
export const redisSub = new Redis(config.REDIS_URL)

// BullMQ setup
export const stemQueue = new Queue('stem-processing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: false // 調査のため保持
  }
})

// HTTP server for Socket.IO integration
const server = createServer((req, res) => {
  const fetch = app.fetch(req as any)
  fetch.then((response: Response) => {
    res.statusCode = response.status
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })
    response.body?.pipeTo(new WritableStream({
      write(chunk) {
        res.write(chunk)
      },
      close() {
        res.end()
      }
    }))
  })
})

// Socket.IO setup
export const io = new Server(server, {
  cors: {
    origin: config.FRONTEND_URL,
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
})

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('[WS] Client connected:', socket.id)
  
  // Join job room
  socket.on(WS_EVENTS.JOIN_JOB, async (jobId: string) => {
    console.log(`[WS] Client ${socket.id} joining job: ${jobId}`)
    socket.join(jobId)
    
    // Send immediate snapshot
    const snapshot = await getJobSnapshot(jobId)
    if (snapshot) {
      socket.emit(WS_EVENTS.JOB_SNAPSHOT, snapshot)
    }
  })
  
  // Leave job room
  socket.on(WS_EVENTS.LEAVE_JOB, (jobId: string) => {
    console.log(`[WS] Client ${socket.id} leaving job: ${jobId}`)
    socket.leave(jobId)
  })
  
  // Request snapshot
  socket.on(WS_EVENTS.REQUEST_SNAPSHOT, async (jobId: string) => {
    const snapshot = await getJobSnapshot(jobId)
    if (snapshot) {
      socket.emit(WS_EVENTS.JOB_SNAPSHOT, snapshot)
    }
  })
  
  socket.on('disconnect', () => {
    console.log('[WS] Client disconnected:', socket.id)
  })
})

// Get job snapshot from Redis
async function getJobSnapshot(jobId: string): Promise<JobSnapshot | null> {
  const data = await redis.hgetall(`job:${jobId}`)
  if (!data.status) return null
  
  return {
    jobId,
    status: data.status as JobSnapshot['status'],
    stage: data.stage as JobSnapshot['stage'],
    progress: parseFloat(data.progress || '0'),
    etaSec: data.etaSec ? parseInt(data.etaSec) : undefined,
    message: data.message,
    version: parseInt(data.version || '0'),
    ts: parseInt(data.updatedAt || Date.now().toString()),
    files: data.files ? JSON.parse(data.files) : undefined,
    error: data.error ? JSON.parse(data.error) : undefined
  }
}

// BullMQ event listeners
const queueEvents = new QueueEvents('stem-processing', {
  connection: redisSub
})

queueEvents.on('active', async ({ jobId }) => {
  console.log(`[Queue] Job ${jobId} started`)
  const progress: JobProgress = {
    jobId,
    stage: 'preprocess',
    progress: 0,
    message: '処理を開始しています...',
    version: Date.now(),
    ts: Date.now()
  }
  await updateJobInRedis(jobId, progress)
  io.to(jobId).emit(WS_EVENTS.JOB_PROGRESS, progress)
})

queueEvents.on('completed', async ({ jobId }) => {
  console.log(`[Queue] Job ${jobId} completed`)
  const snapshot = await getJobSnapshot(jobId)
  if (snapshot) {
    io.to(jobId).emit(WS_EVENTS.JOB_COMPLETE, {
      jobId,
      files: snapshot.files!,
      ts: Date.now()
    })
  }
})

queueEvents.on('failed', async ({ jobId, failedReason }) => {
  console.error(`[Queue] Job ${jobId} failed:`, failedReason)
  io.to(jobId).emit(WS_EVENTS.JOB_ERROR, {
    jobId,
    code: 'JOB_FAILED',
    message: failedReason || '処理に失敗しました',
    retryable: false,
    ts: Date.now()
  })
})

// Helper to update job in Redis
export async function updateJobInRedis(jobId: string, update: Partial<JobProgress>) {
  const multi = redis.multi()
  
  if (update.stage) multi.hset(`job:${jobId}`, 'stage', update.stage)
  if (update.progress !== undefined) multi.hset(`job:${jobId}`, 'progress', update.progress.toString())
  if (update.message) multi.hset(`job:${jobId}`, 'message', update.message)
  if (update.etaSec !== undefined) multi.hset(`job:${jobId}`, 'etaSec', update.etaSec.toString())
  
  multi.hset(`job:${jobId}`, 'version', (update.version || Date.now()).toString())
  multi.hset(`job:${jobId}`, 'updatedAt', Date.now().toString())
  multi.expire(`job:${jobId}`, 7 * 24 * 60 * 60) // 7 days TTL
  
  await multi.exec()
}

// Setup routes
setupUploadRoutes(app)
setupWebhookRoutes(app)
setupJobRoutes(app)

// Start server
const port = config.PORT || 3001
server.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`)
  console.log(`🔌 WebSocket ready on ws://localhost:${port}`)
  console.log(`📦 Redis connected: ${config.REDIS_URL}`)
})