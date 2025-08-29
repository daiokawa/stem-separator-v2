import { Hono } from 'hono'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'
import { stemQueue, redis, io, updateJobInRedis } from '../index'
import { config } from '../config'
import { WS_EVENTS, type UploadCompleteRequest, type UploadCompleteResponse, type UploadStartResponse } from '@stem/types'

const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_KEY
)

export function setupUploadRoutes(app: Hono) {
  // 1. プリサインドURL生成（直PUT用）
  app.post('/api/upload/start', async (c) => {
    try {
      const uploadId = nanoid()
      const fileName = `uploads/${uploadId}/original`
      
      // Supabase Storage のプリサインドURL生成
      const { data, error } = await supabase.storage
        .from('audio-files')
        .createSignedUploadUrl(fileName)
      
      if (error) throw error
      
      // uploadIdをRedisに一時保存（5分TTL）
      await redis.setex(`upload:${uploadId}`, 300, JSON.stringify({
        fileName,
        createdAt: Date.now()
      }))
      
      const response: UploadStartResponse = {
        uploadUrl: data.signedUrl,
        uploadId
      }
      
      return c.json(response)
    } catch (error) {
      console.error('[Upload] Start error:', error)
      return c.json({ error: 'Failed to create upload URL' }, 500)
    }
  })
  
  // 2. アップロード完了通知とジョブ登録
  app.post('/api/upload/complete', async (c) => {
    try {
      const body = await c.req.json<UploadCompleteRequest>()
      
      // Validation
      const schema = z.object({
        uploadId: z.string(),
        fileName: z.string(),
        fileSize: z.number().max(parseInt(config.MAX_FILE_SIZE)),
        mimeType: z.string()
      })
      
      const validated = schema.parse(body)
      
      // uploadIdの検証
      const uploadData = await redis.get(`upload:${validated.uploadId}`)
      if (!uploadData) {
        return c.json({ error: 'Invalid or expired upload ID' }, 400)
      }
      
      // ジョブID生成
      const jobId = `job_${nanoid()}`
      
      // Redisに初期状態保存
      await redis.hset(`job:${jobId}`, {
        status: 'pending',
        stage: 'queued',
        progress: '0',
        fileName: validated.fileName,
        fileSize: validated.fileSize.toString(),
        mimeType: validated.mimeType,
        createdAt: Date.now().toString(),
        updatedAt: Date.now().toString(),
        version: '1'
      })
      
      // BullMQにジョブ追加
      await stemQueue.add(jobId, {
        jobId,
        uploadId: validated.uploadId,
        fileName: validated.fileName,
        fileSize: validated.fileSize,
        mimeType: validated.mimeType
      }, {
        jobId,
        delay: 0,
        attempts: 3,
        timeout: 15 * 60 * 1000 // 15分タイムアウト
      })
      
      // WebSocketで即座に通知
      io.to(jobId).emit(WS_EVENTS.JOB_ACCEPTED, {
        jobId,
        queuedAt: new Date().toISOString()
      })
      
      const response: UploadCompleteResponse = {
        jobId,
        queuedAt: new Date().toISOString()
      }
      
      // upload情報をクリーンアップ
      await redis.del(`upload:${validated.uploadId}`)
      
      return c.json(response)
    } catch (error) {
      console.error('[Upload] Complete error:', error)
      if (error instanceof z.ZodError) {
        return c.json({ error: 'Validation failed', details: error.errors }, 400)
      }
      return c.json({ error: 'Failed to process upload' }, 500)
    }
  })
}