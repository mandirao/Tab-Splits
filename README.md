# TabSplits

A bill-splitting web app: scan a restaurant receipt (AI OCR), assign items to people, and settle up who owes whom — with shareable read-only receipt links.

## Architecture

Migrated from Replit to **GitHub + Vercel + Supabase** (July 2026).

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, wouter, TanStack Query, Tailwind + shadcn/ui |
| API | Express (TypeScript), session auth via `express-session` + `connect-pg-simple` |
| Database | Supabase Postgres, accessed with Drizzle ORM (`drizzle-orm/node-postgres` over the Supabase transaction pooler) |
| File storage | Supabase Storage (private `receipts` bucket, signed upload/download URLs) |
| AI | OpenAI `gpt-4o` for receipt OCR and item categorization |
| Email | Resend (password reset) |
| Hosting | Vercel — static client from `dist/public`, the Express app as a serverless function |

### How it's wired

- `shared/schema.ts` — Drizzle table definitions + zod validation schemas (shared by client and server).
- `server/app.ts` — builds the Express app (sessions, logging, all routes) without listening; used by both entries below.
- `server/index.ts` — local entry: dev mode serves the client through Vite middleware with HMR; `npm start` serves the built client.
- `api/index.mjs` — Vercel serverless entry. At build time, `build:vercel` bundles `server/app.ts` into `api/_app.mjs` (generated, git-ignored) with esbuild.
- `vercel.json` — `/api/*` and `/objects/*` rewrite to the function; everything else falls back to the SPA's `index.html`.
- `server/objectStorage.ts` — receipt images. Clients request `POST /api/uploads/request-url`, PUT the file straight to the returned signed Supabase Storage URL, and store the `/objects/uploads/<uuid>` path; `GET /objects/*` redirects to a short-lived signed download URL.

## Environment variables

See `.env.example`. All are server-side except `VITE_POSTHOG_KEY`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres **transaction pooler** URI (port 6543). URL-encode special characters in the password. |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key; used server-side for Storage signed URLs |
| `OPENAI_API_KEY` | Receipt OCR + item categorization |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Password-reset emails |
| `SESSION_SECRET` | Session cookie signing (`openssl rand -hex 32`) |
| `VITE_POSTHOG_KEY` | Optional client analytics |

Secrets are never committed: `.env` is git-ignored; production values live in Vercel project env vars (`vercel env`).

## Local setup

```sh
npm install
cp .env.example .env   # fill in values
npm run dev            # Express + Vite HMR on http://localhost:5000
```

Other scripts: `npm run check` (typecheck), `npm run build` + `npm start` (production server locally), `npm run db:push` (push schema changes to the database via drizzle-kit).

The database schema already exists in Supabase (migrated via `pg_dump` from the original Replit/Neon database). For a brand-new database, `npm run db:push` creates all tables; the `session` table is created automatically on first run.

## Deployment

Pushes to `main` can be deployed with the Vercel CLI:

```sh
vercel deploy --prod
```

Production: https://tabsplits.vercel.app
