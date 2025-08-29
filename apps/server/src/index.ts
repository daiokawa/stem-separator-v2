import { createServer } from 'http';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Server as IOServer } from 'socket.io';
import crypto from 'node:crypto';

import type {
  JobSnapshot,
  JobAcceptedPayload,
  JobProgressPayload,
  JobCompletePayload,
  JobErrorPayload,
} from './events.js';
import { Events } from './events.js';
import { createStore } from './store.js';
import { enqueueSeparationJob } from './queue.js';

const { store } = createStore();

// Config
const PORT = Number(process.env.PORT || 4000);
const WS_PATH = process.env.WS_PATH || '/ws';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'dev-secret-change-me';

// Hono app
const app = new Hono();
app.use('*', cors());

app.get('/api/ping', (c) => c.json({ ok: true }));

// Complete upload -> create a job and return jobId
app.post('/api/upload/complete', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  // Expected: { fileKey, size, mime }
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const snapshot: JobSnapshot = {
    jobId,
    status: 'queued',
    progress: 0,
    version: 1,
    updatedAt: now,
  };
  const ttlSec = Number(process.env.JOB_TTL_SEC || 7 * 24 * 3600);
  await store.set(jobId, snapshot, ttlSec);
  // Emit accepted event
  const payload: JobAcceptedPayload = { jobId, queuedAt: now };
  io.to(jobId).emit(Events.Accepted, payload);
  // enqueue if Redis/BullMQ available
  await enqueueSeparationJob({ jobId, fileKey: body?.fileKey, size: body?.size, mime: body?.mime });
  return c.json({ jobId }, 202);
});

// Job snapshot
app.get('/api/job/:id', async (c) => {
  const id = c.req.param('id');
  const snapshot = await store.get(id);
  if (!snapshot) return c.json({ error: 'Not found' }, 404);
  return c.json(snapshot);
});

// DEV ONLY: advance progress without webhook (to validate WS/UI quickly)
app.post('/api/dev/advance', async (c) => {
  if (process.env.NODE_ENV === 'production') return c.json({ error: 'forbidden' }, 403);
  const body = await c.req.json().catch(() => null) as any;
  const { jobId, stage, progress } = body || {};
  if (!jobId || typeof progress !== 'number') return c.json({ error: 'bad_request' }, 400);
  const cur = await store.get(jobId);
  if (!cur) return c.json({ error: 'not_found' }, 404);
  const version = cur.version + 1;
  const now = new Date().toISOString();
  const payload = {
    jobId,
    stage: stage || cur.stage || 'preprocess',
    progress: Math.min(100, Math.max(0, progress)),
    version,
    ts: now,
    type: 'progress' as const,
  };
  const updated: JobSnapshot = {
    ...cur,
    status: progress >= 100 ? 'completed' : 'processing',
    stage: payload.stage,
    progress: payload.progress,
    version,
    updatedAt: now,
  };
  const ttlSec = Number(process.env.JOB_TTL_SEC || 7 * 24 * 3600);
  await store.set(jobId, updated, ttlSec);
  if (updated.status === 'completed') {
    io.to(jobId).emit(Events.Complete, { jobId, files: {}, version, ts: now });
  } else {
    io.to(jobId).emit(Events.Progress, payload);
  }
  return c.json({ ok: true, version });
});

// Webhook from Modal.com (signed with HMAC). Idempotent by version.
app.post('/api/webhooks/modal', async (c) => {
  const signature = c.req.header('x-signature') || '';
  const raw = await c.req.text();
  const ok = verifyHmac(raw, WEBHOOK_SECRET, signature);
  if (!ok) return c.json({ error: 'Unauthorized' }, 401);

  const evt = JSON.parse(raw) as
    | ({ type: 'progress' } & JobProgressPayload)
    | ({ type: 'complete' } & JobCompletePayload)
    | ({ type: 'error' } & JobErrorPayload);

  const current = await store.get(evt.jobId);
  const isStale = current && evt.version <= current.version;
  if (isStale) return c.json({ ok: true, ignored: 'stale' });

  const now = new Date().toISOString();

  if (evt.type === 'progress') {
    const updated: JobSnapshot = {
      jobId: evt.jobId,
      status: 'processing',
      stage: evt.stage,
      progress: Math.min(100, Math.max(0, evt.progress)),
      etaSec: evt.etaSec,
      version: evt.version,
      updatedAt: now,
    };
    const ttlSec = Number(process.env.JOB_TTL_SEC || 7 * 24 * 3600);
    await store.set(evt.jobId, updated, ttlSec);
    io.to(evt.jobId).emit(Events.Progress, evt);
  } else if (evt.type === 'complete') {
    const updated: JobSnapshot = {
      jobId: evt.jobId,
      status: 'completed',
      stage: 'upload',
      progress: 100,
      files: evt.files,
      version: evt.version,
      updatedAt: now,
    };
    const ttlSec = Number(process.env.JOB_TTL_SEC || 7 * 24 * 3600);
    await store.set(evt.jobId, updated, ttlSec);
    io.to(evt.jobId).emit(Events.Complete, evt);
  } else if (evt.type === 'error') {
    const updated: JobSnapshot = {
      jobId: evt.jobId,
      status: 'failed',
      progress: 100,
      version: evt.version,
      updatedAt: now,
      error: { code: evt.code, message: evt.message, retryable: evt.retryable },
    };
    const ttlSec = Number(process.env.JOB_TTL_SEC || 7 * 24 * 3600);
    await store.set(evt.jobId, updated, ttlSec);
    io.to(evt.jobId).emit(Events.Error, evt);
  }

  return c.json({ ok: true });
});

// Node <-> Fetch adapter to run Hono on http.createServer
const server = createServer(async (req, res) => {
  try {
    const method = req.method || 'GET';
    const url = `http://${req.headers.host || 'localhost'}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
      else headers.set(k, String(v));
    }
    let body: Buffer | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve) => {
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve());
      });
      body = Buffer.concat(chunks);
    }
    const request = new Request(url, { method, headers, body: body as BodyInit | undefined });
    const response = await app.fetch(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (err) {
    res.statusCode = 500;
    res.end('Internal Server Error');
    console.error(err);
  }
});

// Socket.IO server on same HTTP server
const io = new IOServer(server, {
  path: WS_PATH,
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  const jobId = (socket.handshake.query.jobId as string) || '';
  if (!jobId) {
    socket.disconnect(true);
    return;
  }
  socket.join(jobId);
  store.get(jobId).then((snapshot) => {
    if (snapshot) socket.emit(Events.Snapshot, snapshot);
  });

  socket.on('disconnect', () => {
    // no-op: clients will reconnect automatically
  });
});

const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});

function verifyHmac(payload: string, secret: string, signature: string) {
  try {
    const h = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    // Support either hex string or prefixed like: sha256=xxxxx
    const given = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(given));
  } catch {
    return false;
  }
}
