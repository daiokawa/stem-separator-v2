import { config as loadEnv } from 'dotenv'
import { z } from 'zod'

loadEnv()

const configSchema = z.object({
  PORT: z.string().default('3001'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  
  // Supabase
  SUPABASE_URL: z.string(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_KEY: z.string(),
  
  // Modal.com
  MODAL_ENDPOINT: z.string(),
  MODAL_WEBHOOK_SECRET: z.string().default('secret'),
  
  // Security
  HMAC_SECRET: z.string().default('default-hmac-secret'),
  
  // Limits
  MAX_FILE_SIZE: z.string().default('104857600'), // 100MB
  MAX_CONCURRENT_JOBS: z.string().default('10'),
  
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
})

export const config = configSchema.parse(process.env)