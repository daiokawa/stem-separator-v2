import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createSupabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const jobId = randomUUID();
    const now = new Date().toISOString();
    const supabase = createSupabaseServer();
    // Insert only existing columns (no file_* / preset / version)
    // Demucs/MDX系のpreset値を試す（音声分離モデル名）
    const insert: any = {
      id: jobId,
      status: 'queued',
      progress: 0,
      updated_at: now
    };
    
    // Store melody spec and separation strength in metadata if provided
    const metadata: any = {};
    if (body?.melodySpec) metadata.melody_spec = body.melodySpec;
    if (body?.separationStrength !== undefined) metadata.separation_strength = body.separationStrength;
    
    // Temporarily skip these fields until schema cache is fixed
    // if (body?.fileKey) insert.file_key = body.fileKey;
    // if (body?.size) insert.file_size = body.size;
    // if (body?.mime) insert.file_mime = body.mime;
    // if (Object.keys(metadata).length > 0) insert.metadata = metadata;
    
    const { error } = await supabase.from('jobs').insert(insert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Trigger Modal separation job
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://demo2master-v2.vercel.app';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    // ファイルの完全URLを構築
    let audioUrl = '';
    if (body?.fileKey && supabaseUrl) {
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';
      audioUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${body.fileKey}`;
    }
    
    // Modal処理をトリガー
    if (audioUrl) {
      try {
        await fetch(`${baseUrl}/api/modal/trigger`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ 
            jobId,
            audioUrl
          }),
        });
        console.log('[modal] Triggered separation for job:', jobId);
      } catch (e) {
        console.warn('[modal] trigger failed', (e as Error).message);
      }
    }

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (e) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
}
