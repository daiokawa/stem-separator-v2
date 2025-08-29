STEM SEPARATOR v2 – Monorepo (skeleton)

Packages
- apps/server: Hono + Socket.IO (BFF + WS). In-memory store for now.
- apps/web: Next.js (App Router). Minimal page subscribing to WS events.
- packages/shared: Shared event contracts and types.

Environment
- Node >= 20
- Ports: server 4000, web 3000

Env vars
- apps/server: see apps/server/.env.example
- apps/web: see apps/web/.env.example (NEXT_PUBLIC_WS_URL, NEXT_PUBLIC_API_URL)
  - For server with Redis/BullMQ: set `REDIS_URL`, optional `JOB_TTL_SEC`

Install
1) npm install (workspace root) — installs all workspaces
2) Run server: npm run dev -w @stem/server
3) Run web:    npm run dev -w @stem/web

Notes
- Upload is presigned PUT (to be implemented). For now, POST /api/upload/complete mocks job creation and emits job:accepted.
- Webhook /api/webhooks/modal expects HMAC (x-signature). Use WEBHOOK_SECRET to sign payload.
- WS path is /ws. Client joins a room by supplying ?jobId=... in query.

Vercel preview (cache busting)
- The root route '/' redirects to a unique session URL '/s/<random>' on every request.
- Next.js is set to no-store headers globally to avoid Vercel edge cache during development.
- Configure envs on Vercel Project → Settings → Environment Variables:
  - NEXT_PUBLIC_WS_URL=https://<your-server-domain>
  - NEXT_PUBLIC_API_URL=https://<your-server-domain>

Phase B (Redis + BullMQ)
- Server now supports Redis-backed snapshots with TTL and BullMQ queue.
- Configure `REDIS_URL` to enable:
  - Job snapshots stored under `job:{id}` with TTL (default 7 days).
  - Queue `separation` is created; a minimal worker marks job as processing.
- Without `REDIS_URL`, server falls back to in-memory store (non-persistent).

Local with Redis
1) Run Redis (Docker):
   docker run -p 6379:6379 -d redis:7-alpine
2) Set env and start server:
   REDIS_URL=redis://localhost:6379 npm run dev -w @stem/server


DEV helpers
- Advance progress without webhook:
  curl -X POST http://localhost:4000/api/dev/advance \
    -H 'content-type: application/json' \
    -d '{"jobId":"<ID>","stage":"separate","progress":50}'
- Send signed webhook (progress/complete): see package scripts in apps/server (tsx-based helper).
