import crypto from 'node:crypto';

const SERVER = process.env.SERVER_URL || 'http://localhost:4000';
const SECRET = process.env.WEBHOOK_SECRET || 'dev-secret-change-me';

async function main() {
  const [type] = process.argv.slice(2);
  if (!type || !['progress', 'complete', 'error'].includes(type)) {
    console.error('Usage: tsx scripts/send-webhook.ts <progress|complete|error> JOB_ID VERSION');
    process.exit(1);
  }
  const jobId = process.argv[3];
  const version = Number(process.argv[4] || 2);
  if (!jobId) {
    console.error('JOB_ID required');
    process.exit(1);
  }
  const ts = new Date().toISOString();
  let payload: any;
  if (type === 'progress') {
    payload = { type, jobId, stage: 'separate', progress: 50, version, ts };
  } else if (type === 'complete') {
    payload = { type, jobId, files: { drums: 'url://drums.wav' }, version, ts };
  } else {
    payload = { type, jobId, code: 'MODAL_ERROR', message: 'Failed at stage', retryable: true, version, ts };
  }
  const raw = JSON.stringify(payload);
  const sig = sign(raw, SECRET);
  const res = await fetch(`${SERVER}/api/webhooks/modal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-signature': sig },
    body: raw,
  });
  console.log(res.status, await res.text());
}

function sign(payload: string, secret: string) {
  const h = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${h}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

