import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ReceiptItem } from "@shared/schema";
import { Image, ChevronRight, ArrowRight } from "lucide-react";
import logoUrl from "@assets/icon-1024_1775014486817.png";
import { getDisplayNames } from "@/lib/personDisplay";

interface RedactedPerson {
  id: string;
  name: string;
}

interface RedactedReceipt {
  id: string;
  restaurantName: string;
  date: string;
  subtotal: string;
  tax: string;
  tip: string;
  total: string;
  imageUrl: string | null;
  paidById: string | null;
  paidByName: string | null;
  paidByVenmo: string | null;
}

interface SharedReceiptPayload {
  receipt: RedactedReceipt;
  items: ReceiptItem[];
  people: RedactedPerson[];
}

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

const PERSON_COLORS = [
  'hsl(38, 92%, 50%)',   // Amber
  'hsl(17, 81%, 53%)',   // Coral
  'hsl(345, 77%, 57%)',  // Raspberry
  'hsl(258, 90%, 66%)',  // Violet
  'hsl(217, 91%, 60%)',  // Blue
  'hsl(164, 87%, 39%)',  // Teal
  'hsl(142, 71%, 45%)',  // Lime
  'hsl(330, 81%, 60%)',  // Pink
];

function firstNameOnly(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function SharedItemRow({
  item,
  isAllTab,
  selectedTab,
  getColorForPerson,
  getPersonById,
}: {
  item: ReceiptItem;
  isAllTab: boolean;
  selectedTab: string;
  getColorForPerson: (pid: string) => string;
  getPersonById: (id: string) => { id: string; name: string; color: string } | undefined;
}) {
  const assignedPeople = (item.assignedTo as string[]) || [];
  const isAssigned = assignedPeople.length > 0;
  const qtys = (item.assignedQuantities as Record<string, number>) || {};
  const totalQty = assignedPeople.reduce((s, pid) => s + (qtys[pid] ?? 1), 0);

  const myQty = !isAllTab ? (qtys[selectedTab] ?? 1) : 1;
  let displayPrice = parseFloat(item.price) || 0;
  if (!isAllTab && isAssigned) {
    displayPrice = totalQty > 0
      ? (myQty / totalQty) * displayPrice
      : displayPrice / assignedPeople.length;
  }

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

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div
      className={`flex items-center gap-3 py-3 ${!isAssigned ? 'opacity-60' : ''}`}
      data-testid={`item-row-${item.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {effBadge && (
            <Badge variant="outline" className="text-xs px-1.5 shrink-0">
              {effBadge}
            </Badge>
          )}
          <span className="font-medium text-sm truncate">{item.name}</span>
        </div>
        <span className="text-base font-semibold">${displayPrice.toFixed(2)}</span>
      </div>

      {isAllTab && isAssigned && (
        <div className="flex -space-x-1 shrink-0">
          {assignedPeople.map((pid, idx) => (
            <div
              key={idx}
              className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center ring-2 ring-background"
              style={{ backgroundColor: getColorForPerson(pid) }}
            >
              {getInitials(getPersonById(pid)?.name || "")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SharedReceiptPage({ params }: { params: { token: string } }) {
  const shareToken = params?.token || window.location.pathname.split('/').pop();

  const [isVerified, setIsVerified] = useState(false);
  const [verifiedPersonId, setVerifiedPersonId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("all");

  const tabRowRef = useRef<HTMLDivElement>(null);

  // Always fetch — name selection is just a UX gate, not a security gate
  const { data, isLoading, error } = useQuery<SharedReceiptPayload>({
    queryKey: [`/api/share/${shareToken}`],
  });

  const receipt = data?.receipt;
  const items = data?.items || [];
  const allPeople = data?.people || [];

  const peopleWithColors = allPeople.map((person, idx) => ({
    ...person,
    color: PERSON_COLORS[idx % PERSON_COLORS.length],
  }));

  const displayNames = getDisplayNames(peopleWithColors);
  const getPersonById = (id: string) => peopleWithColors.find(p => p.id === id);
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const getColorForPerson = (id: string) => getPersonById(id)?.color || PERSON_COLORS[0];

  // Scroll the active tab into view whenever selectedTab changes
  useEffect(() => {
    if (!tabRowRef.current) return;
    const active = tabRowRef.current.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedTab]);

  // ── Name picker ──────────────────────────────────────────────────────────────
  if (!isVerified) {
    const loading = isLoading || !data;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-1.5">
              <img src={logoUrl} alt="Tab Splits" className="h-5 w-5 rounded-md" />
              <span className="text-sm font-semibold tracking-wide text-primary">Tab Splits</span>
            </div>
            <div className="space-y-0.5">
              <h1 className="text-2xl font-bold">
                {receipt?.restaurantName || (loading ? "Loading…" : "Shared Tab")}
              </h1>
              <p className="text-sm text-muted-foreground">Who are you?</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="text-center text-sm text-destructive">
              This link may be invalid or expired.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {peopleWithColors.map(person => (
                  <button
                    key={person.id}
                    className="w-full flex items-center justify-between p-4 rounded-lg border hover-elevate active-elevate-2 text-left"
                    onClick={() => {
                      setVerifiedPersonId(person.id);
                      setSelectedTab(person.id);
                      setIsVerified(true);
                    }}
                    data-testid={`button-select-self-${person.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                        style={{ backgroundColor: person.color }}
                      >
                        {getInitials(person.name)}
                      </div>
                      <span className="font-medium">{person.name}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>

              <button
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                onClick={() => {
                  setVerifiedPersonId(null);
                  setSelectedTab("all");
                  setIsVerified(true);
                }}
                data-testid="button-browse-all"
              >
                Just browsing →
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Loading / error (post-verification) ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading receipt…</p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-lg font-semibold">Receipt not found</p>
        <p className="text-sm text-muted-foreground">
          This share link may have expired or is invalid.
        </p>
      </div>
    );
  }

  // ── Calculations ─────────────────────────────────────────────────────────────
  const subtotal = parseFloat(receipt.subtotal) || 0;
  const tax = parseFloat(receipt.tax) || 0;
  const tip = parseFloat(receipt.tip) || 0;
  const total = subtotal + tax + tip;

  const personTotals = new Map<string, { subtotal: number; tax: number; tip: number; total: number }>();
  items.forEach(item => {
    const itemPrice = parseFloat(item.price) || 0;
    const assignedPeople = (item.assignedTo as string[]) || [];
    const qtys = (item.assignedQuantities as Record<string, number>) || {};
    if (assignedPeople.length > 0) {
      const totalQty = assignedPeople.reduce((s, pid) => s + (qtys[pid] ?? 1), 0);
      assignedPeople.forEach(pid => {
        const share = totalQty > 0
          ? ((qtys[pid] ?? 1) / totalQty) * itemPrice
          : itemPrice / assignedPeople.length;
        if (!personTotals.has(pid)) personTotals.set(pid, { subtotal: 0, tax: 0, tip: 0, total: 0 });
        personTotals.get(pid)!.subtotal += share;
      });
    }
  });
  personTotals.forEach((t) => {
    const proportion = subtotal > 0 ? t.subtotal / subtotal : 0;
    t.tax = tax * proportion;
    t.tip = tip * proportion;
    t.total = t.subtotal + t.tax + t.tip;
  });

  // ── Tab filtering ─────────────────────────────────────────────────────────────
  const isAllTab = selectedTab === "all";
  const filteredItems = isAllTab
    ? items
    : items.filter(item => (item.assignedTo as string[] || []).includes(selectedTab));

  const myTotals = !isAllTab ? personTotals.get(selectedTab) : null;

  const hasCategoryData = items.some(item => item.category);
  const CAT_ORDER = ["appetizer", "meal", "dessert", "other", "drink"] as const;
  const CAT_LABELS: Record<string, string> = {
    appetizer: "Appetizers", meal: "Meals", drink: "Drinks", dessert: "Desserts", other: "Other",
  };

  // Only show tabs for people who have at least one item assigned
  const peopleInTabs = peopleWithColors.filter(p => personTotals.has(p.id));

  // Payer from receipt data
  const payer = receipt.paidById ? getPersonById(receipt.paidById) : null;

  // ── Main view ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="p-4 border-b bg-card sticky top-0 z-50">
        <div className="flex items-center justify-between gap-2">
          <div className="w-10 shrink-0" />
          <div className="text-center flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{receipt.restaurantName || "Receipt"}</h1>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <img src={logoUrl} alt="Tab Splits" className="h-4 w-4 rounded-md" />
              <span className="text-xs font-semibold tracking-wide text-primary">Tab Splits</span>
            </div>
          </div>
          {receipt.imageUrl ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" data-testid="button-view-receipt-image">
                  <Image className="h-3.5 w-3.5" />
                  <span>View photo</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto" aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle>Receipt Photo</DialogTitle>
                </DialogHeader>
                <div className="flex items-center justify-center">
                  <img
                    src={receipt.imageUrl}
                    alt="Original receipt"
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                    data-testid="img-receipt-scan"
                  />
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="w-10 shrink-0" />
          )}
        </div>
      </header>

      {/* Tab row */}
      <div className="sticky top-[73px] z-40 bg-background border-b">
        <div
          ref={tabRowRef}
          className="flex overflow-x-auto scrollbar-hide px-3 py-2 gap-2"
        >
          {/* All tab */}
          <button
            data-active={selectedTab === "all"}
            onClick={() => setSelectedTab("all")}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              selectedTab === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover-elevate"
            }`}
            data-testid="tab-all"
          >
            All
          </button>

          {/* Per-person tabs */}
          {peopleInTabs.map(person => {
            const isActive = selectedTab === person.id;
            return (
              <button
                key={person.id}
                data-active={isActive}
                onClick={() => setSelectedTab(person.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  isActive
                    ? "text-white"
                    : "border-border text-muted-foreground hover-elevate"
                }`}
                style={isActive ? { backgroundColor: person.color, borderColor: person.color } : undefined}
                data-testid={`tab-person-${person.id}`}
              >
                {!isActive && (
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: person.color }}
                  />
                )}
                {displayNames.get(person.id) ?? person.name}
              </button>
            );
          })}
        </div>
      </div>

      <main className="p-4 pb-24 space-y-3">

        {/* Items card — totals appended at bottom for person tabs */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="font-semibold text-base">
              {isAllTab ? "Items" : `${firstNameOnly(getPersonById(selectedTab)?.name ?? "")}'s Items`}
            </h2>
          </CardHeader>
          <CardContent className="p-0">
            {filteredItems.length === 0 ? (
              <div className="px-4">
                <p className="text-sm text-muted-foreground py-3">No items assigned.</p>
              </div>
            ) : hasCategoryData ? (
              // ── Category-grouped view ──────────────────────────────────────────
              <>
                {CAT_ORDER.map(cat => {
                  const catItems = filteredItems.filter(i => i.category === cat);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div className="px-4 py-1.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground border-b">
                        {CAT_LABELS[cat]}
                      </div>
                      <div className="divide-y px-4">
                        {catItems.map(item => <SharedItemRow key={item.id} item={item} isAllTab={isAllTab} selectedTab={selectedTab} getColorForPerson={getColorForPerson} getPersonById={getPersonById} />)}
                      </div>
                    </div>
                  );
                })}
                {/* Uncategorized items */}
                {(() => {
                  const uncatItems = filteredItems.filter(i => !i.category);
                  if (uncatItems.length === 0) return null;
                  return (
                    <div>
                      <div className="px-4 py-1.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground border-b">
                        Other
                      </div>
                      <div className="divide-y px-4">
                        {uncatItems.map(item => <SharedItemRow key={item.id} item={item} isAllTab={isAllTab} selectedTab={selectedTab} getColorForPerson={getColorForPerson} getPersonById={getPersonById} />)}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              // ── Flat view (no categories) ──────────────────────────────────────
              <div className="divide-y px-4">
                {filteredItems.map(item => <SharedItemRow key={item.id} item={item} isAllTab={isAllTab} selectedTab={selectedTab} getColorForPerson={getColorForPerson} getPersonById={getPersonById} />)}
              </div>
            )}

            {/* Person-tab totals — connected at the bottom of the items card */}
            {!isAllTab && myTotals && (
              <div className="border-t mx-0 px-4 pt-3 pb-4 space-y-2 mt-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${myTotals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>${myTotals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tip</span>
                  <span>${myTotals.tip.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span data-testid={`text-person-total-${selectedTab}`}>${myTotals.total.toFixed(2)}</span>
                </div>

                {receipt.paidByVenmo &&
                 verifiedPersonId === selectedTab &&
                 receipt.paidById !== selectedTab && (
                  <Button
                    className="w-full mt-1"
                    onClick={() => {
                      const username = encodeURIComponent(receipt.paidByVenmo || "");
                      const amount = myTotals.total.toFixed(2);
                      const note = encodeURIComponent(`Tab Splits - ${receipt.restaurantName || 'Receipt'}`);
                      window.location.href = `venmo://paycharge?txn=pay&recipients=${username}&amount=${amount}&note=${note}`;
                    }}
                    data-testid={`button-pay-venmo-${selectedTab}`}
                  >
                    Pay @{receipt.paidByVenmo} on Venmo
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All tab: Receipt total + who paid — one unified card */}
        {isAllTab && (
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span data-testid="text-receipt-subtotal">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span data-testid="text-receipt-tax">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tip</span>
                <span data-testid="text-receipt-tip">${tip.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span data-testid="text-receipt-total">${total.toFixed(2)}</span>
              </div>

              {/* Who paid — slim inline row */}
              {payer && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <div
                    className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                    style={{ backgroundColor: getColorForPerson(payer.id) }}
                  >
                    {getInitials(payer.name)}
                  </div>
                  <span className="text-sm font-medium">{firstNameOnly(payer.name)} paid</span>
                  {receipt.paidByVenmo && (
                    <button
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => {
                        window.location.href = `venmo://users?username=${encodeURIComponent(receipt.paidByVenmo || "")}`;
                      }}
                      data-testid="button-venmo-payer"
                    >
                      @{receipt.paidByVenmo}
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Signup CTA footer */}
      <div className="border-t bg-card px-6 py-8 text-center space-y-3">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <img src={logoUrl} alt="Tab Splits" className="h-5 w-5 rounded-md" />
          <span className="text-sm font-semibold tracking-wide text-primary">Tab Splits</span>
        </div>
        <p className="text-sm font-medium text-foreground">Split your own tabs for free</p>
        <p className="text-xs text-muted-foreground">
          Scan receipts, assign items, and settle up — all in seconds.
        </p>
        <a href="/login" className="block" data-testid="link-signup-cta">
          <Button variant="outline" className="w-full gap-2">
            Get started
            <ArrowRight className="h-4 w-4" />
          </Button>
        </a>
      </div>
    </div>
  );
}
