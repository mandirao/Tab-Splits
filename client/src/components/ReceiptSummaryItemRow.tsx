import { Badge } from "@/components/ui/badge";
import type { ReceiptItem } from "@shared/schema";
import { getItemLineTotal, getItemTotalShares, getPersonItemShare } from "@shared/splitMath";
import { gcd } from "@/lib/receiptSummary";

export default function ReceiptSummaryItemRow({
  item,
  isAllTab,
  selectedTab,
  getColorForPerson,
  getInitialsForPerson,
}: {
  item: ReceiptItem;
  isAllTab: boolean;
  selectedTab: string;
  getColorForPerson: (pid: string) => string;
  getInitialsForPerson: (pid: string) => string;
}) {
  const assignedPeople = (item.assignedTo as string[]) || [];
  const isAssigned = assignedPeople.length > 0;
  const qtys = (item.assignedQuantities as Record<string, number>) || {};
  const hasQtys = assignedPeople.some(pid => (qtys[pid] ?? 0) > 0);
  const totalQty = getItemTotalShares(item);

  const lineTotal = getItemLineTotal(item);
  const myQty = !isAllTab ? (hasQtys ? (qtys[selectedTab] ?? 0) : 1) : 1;
  const displayPrice = !isAllTab && isAssigned ? getPersonItemShare(item, selectedTab) : lineTotal;

  const itemQty = item.quantity || 1;
  const effNum = itemQty * myQty;
  const effDen = isAllTab ? 1 : totalQty;
  const g = gcd(effNum, effDen);
  const sNum = effNum / g;
  const sDen = effDen / g;
  const effBadge = isAllTab
    ? (itemQty > 1 ? `${itemQty}x` : null)
    : isAssigned && !(sNum === 1 && sDen === 1)
      ? (sDen === 1 ? `${sNum}x` : `${sNum}/${sDen}`)
      : null;

  return (
    <div
      className={`flex items-center gap-2 py-2 ${!isAssigned ? 'opacity-60' : ''}`}
      data-testid={`item-row-${item.id}`}
    >
      {effBadge && (
        <Badge variant="outline" className="text-xs px-1.5 shrink-0">
          {effBadge}
        </Badge>
      )}
      <span className="flex-1 min-w-0 font-medium text-sm truncate">{item.name}</span>
      <span className="text-sm text-muted-foreground tabular-nums shrink-0">${displayPrice.toFixed(2)}</span>
      {isAllTab && isAssigned && (
        <div className="flex -space-x-1 shrink-0">
          {assignedPeople.map((pid, idx) => (
            <div
              key={idx}
              className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center ring-2 ring-background"
              style={{ backgroundColor: getColorForPerson(pid) }}
            >
              {getInitialsForPerson(pid)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
