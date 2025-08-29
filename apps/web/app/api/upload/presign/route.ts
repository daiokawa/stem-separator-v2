import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createSupabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[presign] Supabase not configured, using mock response');
      // Return mock response for development
      return NextResponse.json({ 
        bucket: 'uploads', 
        path: `mock/${randomUUID()}.mp3`, 
        token: 'mock-token' 
      }, { status: 200 });
    }
    
    const body = await req.json().catch(() => ({} as any));
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';
    const ext = (body?.fileName as string | undefined)?.split('.').pop()?.toLowerCase() || 'bin';
    const path = `${new Date().toISOString().slice(0,10)}/${randomUUID().replace(/-/g,'')}.${ext}`;
    const supabase = createSupabaseServer();
    
    // First, try to create the bucket if it doesn't exist
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets && !buckets.find(b => b.name === bucket)) {
      const { error: createError } = await supabase.storage.createBucket(bucket, { public: true });
      if (createError) {
        console.warn(`[presign] Could not create bucket: ${createError.message}`);
      }
    }
    
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) {
      // If bucket doesn't exist, return helpful error
      if (error?.message?.includes('resource does not exist')) {
        return NextResponse.json({ 
          error: 'Storage bucket not configured. Please create "uploads" bucket in Supabase Dashboard.',
          details: 'Go to Storage > New bucket > Name: uploads, Public: ON'
        }, { status: 500 });
      }
      return NextResponse.json({ error: error?.message || 'presign_failed' }, { status: 500 });
    }
    return NextResponse.json({ bucket, path: data.path, token: data.token }, { status: 200 });
  } catch (e: any) {
    console.error('[presign] error:', e);
    return NextResponse.json({ error: e?.message || 'bad_request' }, { status: 400 });
  }
}

