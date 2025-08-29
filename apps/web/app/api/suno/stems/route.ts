import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Suno API統合エンドポイント
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fileUrl, melodySpec, separationStrength = 0.95 } = body;
    
    const SUNO_API_KEY = process.env.SUNO_API_KEY;
    const SUNO_API_URL = process.env.SUNO_API_URL || 'https://api.sunoapi.org';
    
    if (!SUNO_API_KEY) {
      // Suno API未設定時はModal直接利用
      return NextResponse.json({ 
        fallback: true, 
        message: 'Using Modal directly without Suno API' 
      });
    }
    
    // Suno API /api/generate_stemsを呼び出し
    const response = await fetch(`${SUNO_API_URL}/api/generate_stems`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUNO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: fileUrl,
        stem_count: 4, // 4ステム（ボーカル、ドラム、ベース、その他）
        separation_strength: separationStrength,
        melody_spec: melodySpec, // "pop, tempo 120"など
        gpu_type: 'A100', // Modal A100指定
        quality: 'high' // 高品質モード
      })
    });
    
    if (!response.ok) {
      throw new Error(`Suno API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 生成前ステムのURLが含まれているか確認（将来対応）
    if (data.pre_generation_stems) {
      console.log('[SUNO] Pre-generation stems available:', data.pre_generation_stems);
    }
    
    return NextResponse.json({
      jobId: data.job_id,
      status: data.status,
      stems: data.stems || null,
      estimatedTime: data.estimated_seconds || 180,
      preGenerationStems: data.pre_generation_stems || null // 将来対応
    });
    
  } catch (error: any) {
    console.error('[SUNO API] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Suno API error' 
    }, { status: 500 });
  }
}