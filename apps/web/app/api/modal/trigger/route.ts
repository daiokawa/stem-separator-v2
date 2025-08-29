import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Modal関数を呼び出すエンドポイント
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobId, audioUrl } = body;
    
    if (!jobId || !audioUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Webhook URL（Modal→Vercel）
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://web-o3xx01q55-daiokawas-projects.vercel.app'}/api/webhooks/modal`;
    
    // Modal関数を呼び出す
    // 注: Modal SDKがない場合は、Modal CLIまたはHTTP APIを使用
    const modalApiUrl = process.env.MODAL_API_URL || 'https://api.modal.com/v1/functions/stem-separator-v2/separate_stems/call';
    const modalToken = process.env.MODAL_TOKEN;
    
    if (!modalToken) {
      console.warn('[modal] No MODAL_TOKEN, using mock response');
      // モック応答（開発用）
      setTimeout(async () => {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            status: 'completed',
            files: {
              vocals: 'https://example.com/vocals.mp3',
              drums: 'https://example.com/drums.mp3',
              bass: 'https://example.com/bass.mp3',
              other: 'https://example.com/other.mp3'
            }
          })
        });
      }, 5000);
      
      return NextResponse.json({ 
        message: 'Mock processing started',
        jobId 
      });
    }
    
    // Modal API呼び出し
    const response = await fetch(modalApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${modalToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        job_id: jobId,
        preset: 'htdemucs',
        webhook_url: webhookUrl
      })
    });
    
    if (!response.ok) {
      throw new Error(`Modal API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    return NextResponse.json({
      message: 'Separation started',
      jobId,
      modalCallId: result.call_id
    });
    
  } catch (error: any) {
    console.error('[modal] trigger error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to trigger Modal' 
    }, { status: 500 });
  }
}