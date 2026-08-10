# Backlog

Deferred items from the engineering audit (security/scalability/maintainability pass), kept here so they don't get lost.

## Dependency upgrades (breaking, need careful testing)

- **`drizzle-orm` 0.39 → 0.45.2** — `npm audit` flags a high-severity SQL-injection advisory (GHSA-gpj5-g38j-94v9) fixed in this version. Confirmed the vulnerable pattern (raw identifier interpolation) isn't used anywhere in this codebase, so it's not currently exploitable — but the dependency itself is flagged, and the fix requires `npm audit fix --force` since it's a major version bump touching every DB query. Do as its own change with a full regression pass, not bundled into an unrelated commit.
- **`vite`/`esbuild` major bump** — `npm audit` also flags a moderate esbuild advisory (GHSA-67mh-4wv8-2f99: any website can send requests to the local dev server and read the response). Only affects the local dev server, not what's deployed to Vercel. Fix requires `vite@8` via `--force`, a major bump to the whole build toolchain — worth doing deliberately, not urgently.

## Data integrity & scale

- **`deletePerson` scans every item row in the entire app** — `server/storage.ts:233-237` runs `db.select().from(receiptItems)` with no `WHERE` clause at all, pulling every item belonging to every user into memory just to check whether one person is assigned somewhere. Gets slower for everyone as total app-wide item count grows, not just this user's. Fix: scope the query through the person's own receipts, or use a JSONB containment check instead of loading the whole table.
- **Re-scanning a receipt can silently leave it with zero items** — the "re-parse with AI" flow (`client/src/pages/ReceiptDetailPage.tsx:505-516`) deletes all current items, then creates the new ones one HTTP request at a time, with no server-side equivalent to wrap in a transaction. A dropped connection between the delete and the last create leaves the receipt empty with no recovery path. Fix: add one server endpoint that does delete + bulk-insert inside a single `db.transaction`, and have the client call it once.
- **Deleting a receipt is four separate, un-transacted deletes** — `server/storage.ts:129-134` deletes payments, receipt-people, items, and the receipt itself in four sequential statements. A crash between any two leaves orphaned rows or a receipt that appears empty rather than gone. Fix: wrap all four in `db.transaction(async (tx) => {…})` — the one multi-table write in this codebase that actually needs it.
- **AI scan/categorize calls have no timeout guard on Vercel** — `server/routes.ts:330, 462`; `vercel.json` has no `functions` block, so the platform default (10s on Hobby) applies. A busy receipt commonly takes GPT-4o vision 5-20+ seconds to parse — long enough to get killed mid-flight, returning a raw 504 instead of the friendly JSON error this codebase otherwise handles carefully. Fix: raise `maxDuration` in `vercel.json` for the API function, and add a friendly timeout message client-side.
- **No indexes on foreign-key columns** — `shared/schema.ts`: `receipts.userId`, `receiptItems.receiptId`, `people.userId`, `receiptPeople.*`, `payments.*`. Every list query filtering on these does a sequential scan as the table grows. Not urgent — `shareToken` and `users.email` are already indexed via their `.unique()` constraints, and current volume is small. Fix: add `.index()` on the columns above opportunistically, no rush.
- **A few sequential read waterfalls instead of parallel fetches** — `server/storage.ts:319-327` (settlement) and `routes.ts:229-270` (share). Independent reads are `await`ed one after another rather than `Promise.all`'d. Adds latency, not a real scale risk at current receipt/item counts. Fix: batch with `Promise.all` when convenient.

## Infrastructure

- **Postgres connection TLS verification** — `server/db.ts` sets `ssl: { rejectUnauthorized: false }` because Supabase's pooler cert isn't in Node's default CA bundle. Still encrypted, just doesn't verify the server's identity. Proper fix is pinning the pooler's actual CA cert. Low priority, accepted tradeoff for now.

## Observability

- **Error tracking** — currently just `console.error` reaching Vercel's function log viewer, no persistence or alerting. A free-tier Sentry integration would close this cheaply. Needs a decision on provider/setup before wiring in (new external service).

## Maintainability

- **The "add a diner" flow is reimplemented 4 separate times** (`HomePage.tsx`, `RegularsPage.tsx`, `ReceiptDetailPage.tsx`'s `AddPersonPanel`, `ReceiptWizard.tsx`) — ~350+ lines of duplicated contacts-picker/manual-entry logic. Real refactor, same shape as the split-math and receipt-summary-view consolidations already done. Worth its own planning pass.
