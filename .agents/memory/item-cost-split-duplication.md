---
name: Item cost split duplication across views
description: Tab Splits has 4+ independent implementations of "split an item's cost among assigned people" logic; a fix in one place does not propagate to the others.
---

Tab Splits computes "how much does person X owe for item Y" independently in at least: `ReceiptDetailPage.tsx` (admin, two spots — personTotals map and per-item displayPrice), `SharedReceiptPage.tsx` (public share page, two spots — personTotals map and the `SharedReceiptItem` component's own displayPrice), `OrganizerViewPage.tsx` (two spots, same pattern again), `ReceiptWizard.tsx` step 6 review (`effectiveItemCost`/`getPersonItemShare`), and `server/storage.ts` `calculateSettlement`.

**Why:** these all evolved as copy-pasted variants rather than a shared utility, so a bug fix (e.g. correcting quantity-weighted splitting) in one file silently leaves the same bug live in the others. This caused a multi-round debugging session where the same "$8.50 instead of $17" style bug kept reappearing in a new file each time it seemed fixed.

**How to apply:** when fixing any per-item cost/split calculation bug, grep the whole `client/src` (and `server/storage.ts`) for the telltale pattern — dividing `parseFloat(item.price)` by a person/quantity ratio without first multiplying by `item.quantity` — rather than assuming the fix in one file is sufficient. Correct formula: if any `assignedQuantities` value > 0, `personShare = personQty * unitPrice`; otherwise `personShare = (unitPrice * item.quantity) / numAssignedPeople`. Consider extracting this into a shared helper in `client/src/lib/` to prevent future recurrence.
