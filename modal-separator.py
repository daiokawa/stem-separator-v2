"""
Modal Stem Separator - Demucs on GPU
音声ファイルを4つのステム（ボーカル、ドラム、ベース、その他）に分離
"""

import modal
import os
import json
from pathlib import Path

# Modal Appの作成
app = modal.App("stem-separator-v2")

# Dockerイメージの定義（Demucsインストール済み）
demucs_image = modal.Image.debian_slim().pip_install(
    "demucs",
    "torch",
    "torchaudio",
    "requests",
    "boto3"  # S3互換ストレージ用
)

# ボリュームの設定
volume = modal.Volume.from_name("stem-separator-cache", create_if_missing=True)

@app.function(
    image=demucs_image,
    gpu="A10G",  # または "A100" を使いたい場合
    volumes={"/cache": volume},
    timeout=600,  # 10分タイムアウト
    retries=2
)
def separate_stems(
    audio_url: str,
    job_id: str,
    preset: str = "htdemucs",
    webhook_url: str = None
):
    """
    音声ファイルをステムに分離
    
    Args:
        audio_url: 音声ファイルのURL
        job_id: ジョブID
        preset: Demucsモデル（htdemucs, htdemucs_ft, mdx_extra等）
        webhook_url: 進捗通知用Webhook URL
    
    Returns:
        分離されたステムのURL辞書
    """
    import subprocess
    import requests
    from urllib.parse import urlparse
    
    # 進捗通知関数
    def notify_progress(stage: str, progress: int):
        if webhook_url:
            try:
                requests.post(webhook_url, json={
                    "jobId": job_id,
                    "status": "processing",
                    "stage": stage,
                    "progress": progress
                })
            except:
                pass  # エラーを無視
    
    try:
        # 1. ファイルダウンロード
        notify_progress("downloading", 10)
        input_path = f"/tmp/input_{job_id}.mp3"
        output_dir = f"/tmp/output_{job_id}"
        
        response = requests.get(audio_url)
        with open(input_path, "wb") as f:
            f.write(response.content)
        
        # 2. Demucs実行
        notify_progress("processing", 30)
        
        # Demucsコマンド実行
        # --two-stems: ボーカル+伴奏の2ステム
        # --mp3: MP3出力
        # -n: モデル名
        cmd = [
            "python", "-m", "demucs.separate",
            "-n", preset,  # htdemucs, htdemucs_ft, mdx_extra等
            "--out", output_dir,
            "--mp3",  # MP3形式で出力
            input_path
        ]
        
        # 実行
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # 進捗を監視
        for line in process.stderr:
            if "%" in line:
                try:
                    # パーセンテージを抽出
                    percent = int(line.split("%")[0].split()[-1])
                    notify_progress("separating", 30 + int(percent * 0.6))
                except:
                    pass
        
        process.wait()
        
        # 3. 結果ファイルの確認
        notify_progress("uploading", 90)
        
        # 出力ファイルのパス
        stem_dir = Path(output_dir) / preset / Path(input_path).stem
        stems = {
            "vocals": str(stem_dir / "vocals.mp3"),
            "drums": str(stem_dir / "drums.mp3"),
            "bass": str(stem_dir / "bass.mp3"),
            "other": str(stem_dir / "other.mp3")
        }
        
        # 4. Supabase Storageにアップロード（ここは後で実装）
        # 今はローカルパスを返す
        result_urls = {}
        for stem_name, stem_path in stems.items():
            if os.path.exists(stem_path):
                # TODO: Supabase Storageにアップロード
                result_urls[stem_name] = f"file://{stem_path}"
        
        # 5. 完了通知
        if webhook_url:
            requests.post(webhook_url, json={
                "jobId": job_id,
                "status": "completed",
                "progress": 100,
                "files": result_urls
            })
        
        return {
            "success": True,
            "jobId": job_id,
            "files": result_urls
        }
        
    except Exception as e:
        # エラー通知
        if webhook_url:
            requests.post(webhook_url, json={
                "jobId": job_id,
                "status": "failed",
                "error": {
                    "code": "separation_failed",
                    "message": str(e),
                    "retryable": True
                }
            })
        
        return {
            "success": False,
            "jobId": job_id,
            "error": str(e)
        }

@app.local_entrypoint()
def main(
    audio_url: str = "https://example.com/test.mp3",
    job_id: str = "test-job-123",
    webhook_url: str = None
):
    """
    ローカルテスト用エントリーポイント
    
    使用例:
    modal run modal-separator.py --audio-url "https://example.com/song.mp3"
    """
    print(f"Starting separation for job {job_id}")
    result = separate_stems.remote(audio_url, job_id, "htdemucs", webhook_url)
    print(f"Result: {json.dumps(result, indent=2)}")
    return result