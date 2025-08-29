import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createSupabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_SECRET || '';
  const sig = req.headers.get('x-signature') || '';
  const raw = await req.text();
  if (!verifyHmac(raw, secret, sig)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseServer();
  const evt = JSON.parse(raw) as
    | ({ type: 'progress' } & { jobId: string; stage: string; progress: number; version: number; ts?: string; etaSec?: number })
    | ({ type: 'complete' } & { jobId: string; files: any; version: number; ts?: string })
    | ({ type: 'error' } & { jobId: string; code: string; message: string; retryable?: boolean; version: number; ts?: string });

  const now = new Date().toISOString();
  const updated_at = evt.ts || now;
  let update: any = { version: evt.version, updated_at };
  if (evt.type === 'progress') {
    update = { ...update, status: 'processing', stage: evt.stage, progress: evt.progress, eta_sec: evt.etaSec ?? null };
  } else if (evt.type === 'complete') {
    update = { ...update, status: 'completed', stage: 'upload', progress: 100, files: evt.files };
  } else if (evt.type === 'error') {
    update = { ...update, status: 'failed', progress: 100, error_code: evt.code, error_message: evt.message };
  }

  // apply only if incoming version is newer than stored version
  const { error } = await supabase
    .from('jobs')
    .update(update)
    .eq('id', (evt as any).jobId)
    .lt('version', evt.version);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

function verifyHmac(payload: string, secret: string, signature: string) {
  try {
    const digest = createHmac('sha256', secret).update(payload).digest('hex');
    const given = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    return timingSafeEqual(Buffer.from(digest), Buffer.from(given));
  } catch {
    return false;
  }
}
