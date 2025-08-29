import { Hono } from 'hono'
import { createHmac } from 'crypto'
import { z } from 'zod'
import { io, updateJobInRedis } from '../index'
import { config } from '../config'
import { WS_EVENTS, type WebhookPayload, type JobProgress } from '@stem/types'

export function setupWebhookRoutes(app: Hono) {
  // Modal.com からのWebhook受信
  app.post('/api/webhooks/modal', async (c) => {
    try {
      const signature = c.req.header('x-webhook-signature')
      const body = await c.req.text()
      
      // HMAC署名検証
      if (!verifyWebhookSignature(body, signature || '')) {
        console.error('[Webhook] Invalid signature')
        return c.json({ error: 'Invalid signature' }, 401)
      }
      
      const payload: WebhookPayload = JSON.parse(body)
      
      // Validation
      const schema = z.object({
        jobId: z.string(),
        event: z.enum(['progress', 'complete', 'error']),
        data: z.object({
          stage: z.string().optional(),
          progress: z.number().optional(),
          message: z.string().optional(),
          files: z.object({
            drums: z.string().optional(),
            bass: z.string().optional(),
            vocals: z.string().optional(),
            other: z.string().optional()
          }).optional(),
          error: z.string().optional()
        }),
        timestamp: z.number()
      })
      
      const validated = schema.parse(payload)
      
      // イベントタイプごとの処理
      switch (validated.event) {
        case 'progress': {
          const progress: JobProgress = {
            jobId: validated.jobId,
            stage: (validated.data.stage || 'separate') as JobProgress['stage'],
            progress: validated.data.progress || 0,
            message: validated.data.message,
            version: validated.timestamp,
            ts: Date.now()
          }
          
          await updateJobInRedis(validated.jobId, progress)
          io.to(validated.jobId).emit(WS_EVENTS.JOB_PROGRESS, progress)
          break
        }
        
        case 'complete': {
          await updateJobInRedis(validated.jobId, {
            stage: 'complete',
            progress: 100,
            message: '処理が完了しました'
          })
          
          // ファイル情報を保存
          if (validated.data.files) {
            await redis.hset(`job:${validated.jobId}`, 'files', JSON.stringify(validated.data.files))
            await redis.hset(`job:${validated.jobId}`, 'status', 'completed')
          }
          
          io.to(validated.jobId).emit(WS_EVENTS.JOB_COMPLETE, {
            jobId: validated.jobId,
            files: validated.data.files!,
            ts: Date.now()
          })
          break
        }
        
        case 'error': {
          await updateJobInRedis(validated.jobId, {
            stage: 'error',
            message: validated.data.error || 'Unknown error'
          })
          
          await redis.hset(`job:${validated.jobId}`, 'status', 'failed')
          await redis.hset(`job:${validated.jobId}`, 'error', JSON.stringify({
            message: validated.data.error,
            timestamp: validated.timestamp
          }))
          
          io.to(validated.jobId).emit(WS_EVENTS.JOB_ERROR, {
            jobId: validated.jobId,
            code: 'PROCESSING_ERROR',
            message: validated.data.error || 'Processing failed',
            retryable: false,
            ts: Date.now()
          })
          break
        }
      }
      
      // Always return 200 (idempotent)
      return c.json({ ok: true })
    } catch (error) {
      console.error('[Webhook] Error:', error)
      // Still return 200 to prevent retries
      return c.json({ ok: true })
    }
  })
}

function verifyWebhookSignature(body: string, signature: string): boolean {
  const expectedSignature = createHmac('sha256', config.HMAC_SECRET)
    .update(body)
    .digest('hex')
  
  return signature === expectedSignature
}