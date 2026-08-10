/**
 * Single source of truth for turning a receipt line item into dollar amounts
 * owed per person. `item.price` is always the TOTAL cost of the line (it
 * already covers every unit in `quantity` — see server/routes.ts scan prompt),
 * never a per-unit price.
 *
 * `assignedQuantities` is a relative weight, not a literal unit count — the
 * assign-person UI lets people split an item into weighted "shares" (e.g. 1
 * share each for 4 people splitting a single appetizer) independent of how
 * many physical units were purchased. A person with no explicit weight entry
 * defaults to a weight of 1, matching AssignPersonSheetBody's own display math.
 */

export interface SplittableItem {
  price: string | number;
  assignedTo?: string[] | null;
  assignedQuantities?: Record<string, number> | null;
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Total dollar cost of this line item. */
export function getItemLineTotal(item: Pick<SplittableItem, "price">): number {
  return toNumber(item.price);
}

/** True when at least one assigned person has an explicit custom share weight. */
function hasCustomShares(assignedTo: string[], qtys: Record<string, number>): boolean {
  return assignedTo.some(pid => (qtys[pid] ?? 0) > 0);
}

/**
 * Total number of "shares" this item is divided into: the sum of everyone's
 * weight when custom shares are set, otherwise just the number of people
 * splitting it evenly.
 */
export function getItemTotalShares(item: Pick<SplittableItem, "assignedTo" | "assignedQuantities">): number {
  const assignedTo = item.assignedTo ?? [];
  const qtys = item.assignedQuantities ?? {};
  if (!hasCustomShares(assignedTo, qtys)) return assignedTo.length;
  return assignedTo.reduce((sum, pid) => sum + (qtys[pid] ?? 1), 0);
}

/** Dollar share of this line item for every person it's assigned to. */
export function getItemShares(item: SplittableItem): Record<string, number> {
  const assignedTo = item.assignedTo ?? [];
  if (assignedTo.length === 0) return {};

  const lineTotal = getItemLineTotal(item);
  const qtys = item.assignedQuantities ?? {};
  const shares: Record<string, number> = {};

  if (hasCustomShares(assignedTo, qtys)) {
    const totalShares = getItemTotalShares(item);
    for (const personId of assignedTo) {
      shares[personId] = totalShares > 0 ? ((qtys[personId] ?? 1) / totalShares) * lineTotal : 0;
    }
  } else {
    const evenShare = lineTotal / assignedTo.length;
    for (const personId of assignedTo) {
      shares[personId] = evenShare;
    }
  }

  return shares;
}

/** Dollar share of this line item owed by a single person (0 if not assigned). */
export function getPersonItemShare(item: SplittableItem, personId: string): number {
  return getItemShares(item)[personId] ?? 0;
}

export interface PersonTotals {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

/**
 * Per-person subtotal, tax, tip, and total across every item on a receipt.
 * Tax and tip are split proportionally to each person's share of the subtotal.
 */
export function getPersonTotals(
  items: SplittableItem[],
  receiptTotals: { subtotal: number; tax: number; tip: number }
): Map<string, PersonTotals> {
  const personTotals = new Map<string, PersonTotals>();

  items.forEach(item => {
    const shares = getItemShares(item);
    Object.entries(shares).forEach(([personId, share]) => {
      if (!personTotals.has(personId)) {
        personTotals.set(personId, { subtotal: 0, tax: 0, tip: 0, total: 0 });
      }
      personTotals.get(personId)!.subtotal += share;
    });
  });

  personTotals.forEach(t => {
    const proportion = receiptTotals.subtotal > 0 ? t.subtotal / receiptTotals.subtotal : 0;
    t.tax = receiptTotals.tax * proportion;
    t.tip = receiptTotals.tip * proportion;
    t.total = t.subtotal + t.tax + t.tip;
  });

  return personTotals;
}
