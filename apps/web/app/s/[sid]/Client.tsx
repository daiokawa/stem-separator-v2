"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import WaveSurfer from "wavesurfer.js";
import { supabase } from "@/lib/supabaseClient";
import type { JobSnapshot } from "@/lib/events";

interface ClientProps {
  sid: string;
}

export default function SessionClient({ sid }: ClientProps) {
  const [jobId, setJobId] = useState<string>("");
  const [snap, setSnap] = useState<JobSnapshot | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [melodySpec, setMelodySpec] = useState<string>("");
  const [separationStrength, setSeparationStrength] = useState<number>(0.9);

  useEffect(() => {
    if (!jobId) return;
    // initial snapshot
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' });
        if (res.ok) {
          const s: JobSnapshot = await res.json();
          setSnap((prev) => (!prev || s.version > prev.version ? s : prev));
        }
      } catch {}
    })();
    // realtime subscription to jobs table
    const channel = supabase
      .channel(`job:${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` }, (payload) => {
        const row: any = payload.new;
        if (!row) return;
        setLogs((l) => [`[change] ${payload.eventType} v${row.version} ${row.stage ?? ''} ${row.progress ?? ''}%`, ...l]);
        setSnap((prev) => {
          const incoming: JobSnapshot = {
            jobId: row.id,
            status: row.status,
            stage: row.stage ?? undefined,
            progress: row.progress ?? 0,
            etaSec: row.eta_sec ?? undefined,
            files: row.files ?? undefined,
            version: row.version ?? 0,
            updatedAt: row.updated_at,
            error: row.error_code ? { code: row.error_code, message: row.error_message, retryable: row.error_retryable } : undefined,
          };
          if (!prev) return incoming;
          return incoming.version > prev.version ? incoming : prev;
        });
      })
      .subscribe((status) => {
        setLogs((l) => [`[sub] ${status}`, ...l]);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, sid]);

  const onDrop = useCallback(async (files: File[]) => {
    if (!files?.length) return;
    const file = files[0];
    setSelectedFile(file);
    setUploadError(null);
    setUploading(true);
    try {
      // 1) presign
      const pres = await fetch(`/api/upload/presign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type })
      });
      if (!pres.ok) throw new Error('presign_failed');
      const { bucket, path, token } = await pres.json();
      // 2) upload to signed url via supabase client
      const up = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file, { contentType: file.type, upsert: true });
      if (up.error) throw up.error;
      // 3) create job with melody spec and separation strength
      const res = await fetch(`/api/upload/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          fileKey: path, 
          size: file.size, 
          mime: file.type,
          melodySpec: melodySpec || undefined,
          separationStrength
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'create_job_failed');
      setJobId(data.jobId);
      setLogs((l) => [
        `[upload] ${file.name} -> ${bucket}/${path}`,
        ...(melodySpec ? [`[config] melody: ${melodySpec}, strength: ${separationStrength}`] : []),
        ...l,
      ]);
    } catch (e: any) {
      setUploadError(e?.message || 'upload_failed');
    } finally {
      setUploading(false);
    }
  }, [sid, melodySpec, separationStrength]);

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'audio/mpeg': ['.mp3'],
      'audio/mp4': ['.m4a'],
      'audio/x-m4a': ['.m4a'],
      'audio/wav': ['.wav'],
      'audio/x-wav': ['.wav']
    },
    maxFiles: 1
  });

  function StageBadge() {
    const stage = snap?.status === 'completed' ? '完了' : snap?.status === 'processing' ? '処理中' : jobId ? '待機中' : 'アップロード';
    const color = stage === '完了' ? 'bg-emerald-500/20 text-emerald-300' : stage === '処理中' ? 'bg-purple-500/20 text-purple-300' : 'bg-white/10 text-white/60';
    return <span className={`px-3 py-1.5 rounded text-base font-bold ${color}`}>{stage}</span>;
  }

  function ProgressBar() {
    const p = Math.max(0, Math.min(100, snap?.progress ?? 0));
    return (
      <div className="progress w-full"><div style={{ width: `${p}%` }} /></div>
    );
  }

  type StemKey = 'vocals' | 'drums' | 'bass' | 'other';
  const stems: { key: StemKey; label: string; icon: string }[] = [
    { key: 'vocals', label: 'ボーカル', icon: '🎤' },
    { key: 'drums', label: 'ドラム', icon: '🥁' },
    { key: 'bass', label: 'ベース', icon: '🎸' },
    { key: 'other', label: 'その他', icon: '🎹' },
  ];

  function StemRow({ label, icon, url }: { label: string; icon: string; url?: string }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const wsRef = useRef<WaveSurfer | null>(null);
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (!containerRef.current || !url) return;
      setLoading(true);
      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: '#5b5b5f',
        progressColor: '#a78bfa',
        height: 64,
        barWidth: 2,
        normalize: true,
        url,
      });
      wsRef.current = ws;
      ws.on('play', () => setPlaying(true));
      ws.on('pause', () => setPlaying(false));
      ws.on('ready', () => setLoading(false));
      return () => { ws.destroy(); };
    }, [url]);

    const onToggle = () => {
      wsRef.current?.playPause();
    };

    return (
      <div className="bg-white/5 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <span className="w-28 inline-block text-lg font-bold text-white">{label}</span>
            {url ? (
              <a className="text-purple-400 hover:text-purple-300 transition-colors text-base font-semibold" href={url} target="_blank" rel="noreferrer">
                ダウンロード
              </a>
            ) : (
              <span className="text-white/40 text-base">準備中</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              className="px-4 py-2 rounded text-base font-semibold bg-purple-600/20 hover:bg-purple-600/30 transition-colors disabled:opacity-50" 
              onClick={onToggle} 
              disabled={!url || loading}
            >
              {playing ? '⏸ 一時停止' : '▶ 再生'}
            </button>
          </div>
        </div>
        <div className="w-full">
          {url ? (
            loading ? (
              <div className="h-16 bg-white/5 rounded animate-pulse" />
            ) : (
              <div ref={containerRef} className="w-full" />
            )
          ) : (
            <div className="h-16 bg-white/5 rounded" />
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            STEM SEPARATOR v2.0
          </h1>
          <p className="text-white/80 text-lg font-semibold mt-2">セッション: {sid.slice(0, 8)}</p>
        </div>
        <StageBadge />
      </header>

      {/* Upload area */}
      <section className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-xl p-6 mb-6 border border-purple-500/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">音源アップロード</h2>
          {selectedFile && (
            <span className="text-white/80 text-lg font-semibold">
              {selectedFile.name} • {(selectedFile.size/1024/1024).toFixed(2)} MB
            </span>
          )}
        </div>
        <div {...getRootProps({ 
          className: `border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            isDragActive 
              ? 'border-purple-400 bg-purple-500/10 scale-[1.02]' 
              : 'border-white/20 hover:border-purple-400/50 hover:bg-white/5'
          }` 
        })}>
          <input {...getInputProps()} />
          <div className="text-4xl mb-3">📁</div>
          <p className="mb-2 text-white text-xl font-bold">
            音声ファイルをドラッグ&ドロップ、またはクリックして選択
          </p>
          <p className="text-white/80 text-lg">
            対応形式: MP3, M4A, WAV • 最大 ~100MB
          </p>
        </div>
        
        {/* Advanced Settings */}
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-lg font-bold text-white/90 block mb-2">
              メロディ仕様（任意）
            </label>
            <input
              className="bg-black/30 border border-white/10 rounded px-3 py-2 w-full text-base focus:border-purple-400 focus:outline-none"
              placeholder="例: pop, tempo 120, key C major"
              value={melodySpec}
              onChange={(e) => setMelodySpec(e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-lg font-bold text-white/90 block mb-2">
              分離強度: {separationStrength}
            </label>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.1"
              value={separationStrength}
              onChange={(e) => setSeparationStrength(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-base text-white/70 mt-1">
              <span>弱い (0.5)</span>
              <span>強い (1.0)</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button 
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-lg transition-all text-lg font-bold disabled:opacity-50" 
            onClick={() => acceptedFiles.length && onDrop(acceptedFiles as any)} 
            disabled={uploading || !selectedFile}
          >
            {uploading ? 'アップロード中…' : '処理開始'}
          </button>
          <input
            className="bg-black/30 border border-white/10 rounded px-3 py-3 flex-1 max-w-[360px] text-base focus:border-purple-400 focus:outline-none"
            placeholder="または既存のジョブIDを貼り付け"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
          />
          {uploadError && <span className="text-red-400 text-sm">{uploadError}</span>}
        </div>
      </section>

      {/* Progress */}
      {jobId && (
        <section className="bg-white/5 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl font-bold">進捗状況</h2>
            <span className="text-white/80 text-lg font-semibold">
              {snap?.etaSec ? `残り約 ${Math.ceil((snap.etaSec)/60)} 分` : '—'}
            </span>
          </div>
          <ProgressBar />
          <div className="mt-2 text-lg font-semibold text-white/80">
            ステージ: {snap?.stage ?? '待機中'}
          </div>
        </section>
      )}

      {/* Stems */}
      <section className="bg-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">分離されたステム</h2>
          {snap?.status === 'completed' && (
            <span className="text-emerald-400 text-lg font-semibold">✨ ダウンロード可能</span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stems.map(({ key, label, icon }) => (
            <StemRow key={key} label={label} icon={icon} url={(snap?.files as any)?.[key]} />
          ))}
        </div>
      </section>

      {/* Logs */}
      {logs.length > 0 && (
        <section className="mt-6">
          <h3 className="text-lg font-bold mb-2 text-white/80">イベントログ</h3>
          <ul className="text-xs space-y-1 max-h-32 overflow-auto bg-black/20 rounded p-3">
            {logs.map((l, i) => (
              <li key={i} className="text-white/50 font-mono">{l}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}