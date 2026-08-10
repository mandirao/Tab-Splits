# Backlog

Deferred items from the engineering audit (security/scalability/maintainability pass), kept here so they don't get lost.

## Dependency upgrades (breaking, need careful testing)

- **`drizzle-orm` 0.39 → 0.45.2** — `npm audit` flags a high-severity SQL-injection advisory (GHSA-gpj5-g38j-94v9) fixed in this version. Confirmed the vulnerable pattern (raw identifier interpolation) isn't used anywhere in this codebase, so it's not currently exploitable — but the dependency itself is flagged, and the fix requires `npm audit fix --force` since it's a major version bump touching every DB query. Do as its own change with a full regression pass, not bundled into an unrelated commit.
- **`vite`/`esbuild` major bump** — `npm audit` also flags a moderate esbuild advisory (GHSA-67mh-4wv8-2f99: any website can send requests to the local dev server and read the response). Only affects the local dev server, not what's deployed to Vercel. Fix requires `vite@8` via `--force`, a major bump to the whole build toolchain — worth doing deliberately, not urgently.

## Infrastructure

- **Postgres connection TLS verification** — `server/db.ts` sets `ssl: { rejectUnauthorized: false }` because Supabase's pooler cert isn't in Node's default CA bundle. Still encrypted, just doesn't verify the server's identity. Proper fix is pinning the pooler's actual CA cert. Low priority, accepted tradeoff for now.

## Observability

- **Error tracking** — currently just `console.error` reaching Vercel's function log viewer, no persistence or alerting. A free-tier Sentry integration would close this cheaply. Needs a decision on provider/setup before wiring in (new external service).

## Also still open (not from the "3 items" above, but tracked here too)

- **The "add a diner" flow is reimplemented 4 separate times** (`HomePage.tsx`, `RegularsPage.tsx`, `ReceiptDetailPage.tsx`'s `AddPersonPanel`, `ReceiptWizard.tsx`) — ~350+ lines of duplicated contacts-picker/manual-entry logic. Real refactor, same shape as the split-math and receipt-summary-view consolidations already done. Worth its own planning pass.
