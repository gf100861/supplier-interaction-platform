# Tencent Cloud migration preparation

This project currently uses a React CRA frontend, an Express backend, and Supabase for database, auth, storage, and some frontend realtime/client calls. The safest Tencent Cloud migration is an adapter migration: keep the existing API shape and page behavior, then replace each Supabase responsibility behind the backend.

## Target architecture

- Frontend: keep the existing React app and routes unchanged.
- Backend: deploy the existing Express app to Tencent Cloud Lighthouse/CVM/SCF container, with `server.js` as the long-running process.
- Database: Tencent Cloud PostgreSQL or TDSQL-C PostgreSQL, accessed through Prisma.
- Database admin UI: Prisma Studio, run locally or through a protected internal tunnel only.
- Auth: backend-managed email/password login with hashed passwords and JWT access tokens.
- Storage: Tencent Cloud COS. The backend signs temporary upload/download URLs; the browser uploads directly to COS with `PUT`.

## Files added for preparation

- `supplier-platform-backend/.env.tencent.example`: backend environment variables for Tencent Cloud.
- `supplier-platform-frontend/.env.tencent.example`: frontend build variables for the Tencent backend URL.
- `supplier-platform-backend/prisma/schema.prisma`: initial Prisma schema draft inferred from current Supabase usage.
- `supplier-platform-backend/lib/prisma.js`: reusable Prisma client singleton.
- `supplier-platform-backend/lib/jwt.js`: JWT sign/verify helpers for the future auth swap.
- `supplier-platform-backend/lib/tencent-cos.js`: COS signing helper.
- `supplier-platform-backend/controllers/file-sync/presign-cos.js`: draft controller for COS pre-signed upload/download URLs.

The COS controller is intentionally not wired into `server.js` yet. This keeps the current app running without Tencent Cloud credentials and avoids changing existing behavior.

## Migration order

1. Create Tencent Cloud PostgreSQL/TDSQL-C PostgreSQL and copy its connection string into `DATABASE_URL`.
2. Validate the Prisma schema against the real database model. If you can export the Supabase schema later, prefer `npx prisma db pull` to avoid guessing column types.
3. Run `npm run prisma:generate`, then use `npm run prisma:studio` locally to inspect the database.
4. Add password hashes to the `users` table and migrate login from Supabase Auth to backend JWT.
5. Replace backend Supabase table queries with Prisma, one controller at a time.
6. Replace frontend direct Supabase calls with backend APIs. Current direct-call hotspots include login session sync, password reset/update, realtime notices, file upload/download, and a few admin/notice helper queries.
7. Enable COS pre-signed upload/download endpoints, then switch upload pages to request a signed URL and upload directly to COS.
8. Remove Supabase env vars and dependencies only after the final direct Supabase call is gone.

## Commands

From `supplier-platform-backend`:

```bash
npm install
npm run prisma:generate
npm run prisma:studio
```

When the schema is finalized:

```bash
npm run prisma:migrate -- --name initial_tencent_cloud_schema
```

For production deployment after migrations already exist:

```bash
npm run prisma:deploy
npm start
```

## Tencent Cloud deployment notes

- Use a long-running Node process for Socket.IO support. Vercel serverless does not support the current WebSocket behavior well.
- Put the backend behind HTTPS through Tencent Cloud Load Balancer, Lighthouse application firewall, Nginx, or a managed gateway.
- Keep Prisma Studio private. Do not expose it publicly without VPN, IP allowlist, or another strong access control layer.
- Store `TENCENT_COS_SECRET_ID` and `TENCENT_COS_SECRET_KEY` only on the backend. Never place them in React environment variables.
- Configure COS CORS to allow the frontend origin, `PUT`, `GET`, and the `Content-Type` header.

## COS direct upload flow

1. Frontend asks backend for a signed upload URL with file name, MIME type, and target user id.
2. Backend returns `{ key, method: "PUT", signedUrl, publicUrl, expiresIn }`.
3. Frontend uploads the file bytes directly to `signedUrl`.
4. Frontend or backend stores `key`/`publicUrl` in the database.
5. Downloads use a signed `GET` URL unless the bucket/object is intentionally public.

## Current compatibility boundary

Until the controller migration is complete, these Supabase variables are still required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

This is expected during the preparation phase and prevents a risky all-at-once rewrite.
