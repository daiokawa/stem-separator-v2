// Suno API 非公開エンドポイント調査スクリプト
// 注意：研究目的のみ

const SUNO_API_KEY = process.env.SUNO_API_KEY;

// 調査対象エンドポイント
const endpoints = [
  '/api/generate',           // 標準生成
  '/api/generate/stems',     // ステム付き生成？
  '/api/get_raw_stems',      // 生ステム？
  '/api/internal/stems',     // 内部API？
  '/api/v2/generate',        // v2 API？
  '/api/pro/stems',          // Proユーザー限定？
];

async function investigateSunoAPI() {
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`https://api.sunoapi.org${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUNO_API_KEY}`,
        }
      });
      
      console.log(`${endpoint}: ${response.status}`);
      
      if (response.status === 200) {
        const data = await response.json();
        // ステム関連のフィールドを探す
        if (data.stems || data.tracks || data.pre_generation || data.raw_stems) {
          console.log('🎯 Found potential stems:', data);
        }
      }
    } catch (e) {
      console.log(`${endpoint}: Error`);
    }
  }
}

// レスポンス解析
async function analyzeGenerateResponse() {
  const response = await fetch('https://api.sunoapi.org/api/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUNO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: 'test',
      make_instrumental: false,
      wait_audio: false
    })
  });
  
  const data = await response.json();
  
  // 隠れフィールドを全て出力
  console.log('Full response:', JSON.stringify(data, null, 2));
  
  // ステム関連URLパターンを探す
  const json = JSON.stringify(data);
  const stemPatterns = [
    /stems?\/.*?\.(mp3|wav)/gi,
    /tracks?\/.*?\.(mp3|wav)/gi,
    /vocal.*?\.(mp3|wav)/gi,
    /drum.*?\.(mp3|wav)/gi,
    /bass.*?\.(mp3|wav)/gi,
  ];
  
  for (const pattern of stemPatterns) {
    const matches = json.match(pattern);
    if (matches) {
      console.log('🔍 Found pattern:', matches);
    }
  }
}

// 実行
investigateSunoAPI();
analyzeGenerateResponse();