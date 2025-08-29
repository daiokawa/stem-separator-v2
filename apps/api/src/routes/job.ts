import { Hono } from 'hono'
import { redis } from '../index'
import { type JobStatusResponse } from '@stem/types'

export function setupJobRoutes(app: Hono) {
  // ジョブステータス取得（REST）
  app.get('/api/job/:id', async (c) => {
    try {
      const jobId = c.req.param('id')
      const data = await redis.hgetall(`job:${jobId}`)
      
      if (!data.status) {
        return c.json({ error: 'Job not found' }, 404)
      }
      
      const response: JobStatusResponse = {
        jobId,
        status: data.status as JobStatusResponse['status'],
        stage: data.stage as JobStatusResponse['stage'],
        progress: parseFloat(data.progress || '0'),
        files: data.files ? JSON.parse(data.files) : undefined,
        error: data.error ? JSON.parse(data.error) : undefined
      }
      
      return c.json(response)
    } catch (error) {
      console.error('[Job] Get status error:', error)
      return c.json({ error: 'Failed to get job status' }, 500)
    }
  })
}