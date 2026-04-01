import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ReceiptItem } from "@shared/schema";
import { Image, DollarSign, ChevronRight } from "lucide-react";

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
  'hsl(330, 75%, 65%)',
  'hsl(340, 80%, 60%)',
  'hsl(25, 90%, 62%)',
  'hsl(15, 85%, 65%)',
  'hsl(45, 95%, 65%)',
  'hsl(185, 65%, 70%)',
  'hsl(195, 70%, 65%)',
  'hsl(280, 55%, 68%)',
  'hsl(270, 60%, 70%)',
  'hsl(35, 85%, 68%)',
];

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
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold">
              {receipt?.restaurantName || (loading ? "Loading…" : "Shared Tab")}
            </h1>
            <p className="text-sm text-muted-foreground">Who are you?</p>
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

  const filteredPersonTotals = isAllTab
    ? Array.from(personTotals.entries())
    : Array.from(personTotals.entries()).filter(([id]) => id === selectedTab);

  // For the "my tab" summary totals when a person tab is active
  const myTotals = !isAllTab ? personTotals.get(selectedTab) : null;

  // ── Main view ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="p-4 border-b bg-card sticky top-0 z-50">
        <div className="flex items-center justify-between gap-2">
          <div className="w-10 shrink-0" />
          <div className="text-center flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{receipt.restaurantName || "Receipt"}</h1>
            <p className="text-sm text-muted-foreground">Shared Tab</p>
          </div>
          {receipt.imageUrl ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" data-testid="button-view-receipt-image">
                  <Image className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto" aria-describedby={undefined}>
                <DialogHeader>
                  <DialogTitle>Original Receipt</DialogTitle>
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
          {peopleWithColors.map(person => {
            const isActive = selectedTab === person.id;
            return (
              <button
                key={person.id}
                data-active={isActive}
                onClick={() => setSelectedTab(person.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover-elevate"
                }`}
                data-testid={`tab-person-${person.id}`}
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: person.color }}
                />
                {person.name}
              </button>
            );
          })}
        </div>
      </div>

      <main className="p-4 pb-24 space-y-4">

        {/* Items card */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="font-semibold text-base">
              {isAllTab ? "Items" : `${getPersonById(selectedTab)?.name}'s Items`}
            </h2>
          </CardHeader>
          <CardContent className="divide-y">
            {filteredItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No items assigned.</p>
            ) : (
              filteredItems.map(item => {
                const assignedPeople = (item.assignedTo as string[]) || [];
                const isAssigned = assignedPeople.length > 0;
                const qtys = (item.assignedQuantities as Record<string, number>) || {};
                const totalQty = assignedPeople.reduce((s, pid) => s + (qtys[pid] ?? 1), 0);

                // Per-person share for this item (when on a person tab)
                const myQty = !isAllTab ? (qtys[selectedTab] ?? 1) : 1;
                let displayPrice = parseFloat(item.price) || 0;
                if (!isAllTab && isAssigned) {
                  displayPrice = totalQty > 0
                    ? (myQty / totalQty) * displayPrice
                    : displayPrice / assignedPeople.length;
                }
                // Compute a single effective-qty badge for person tabs
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
                    key={item.id}
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
                      <span className="text-base font-semibold">
                        ${displayPrice.toFixed(2)}
                      </span>
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
              })
            )}
          </CardContent>
        </Card>

        {/* Summary card — person-tab shows a single clean breakdown */}
        {!isAllTab && myTotals ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                  style={{ backgroundColor: getColorForPerson(selectedTab) }}
                >
                  {getInitials(getPersonById(selectedTab)?.name || "")}
                </div>
                <h2 className="font-semibold text-base">{getPersonById(selectedTab)?.name}'s Total</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
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
              <div className="flex justify-between text-xl font-bold pt-2 border-t">
                <span>Total</span>
                <span>${myTotals.total.toFixed(2)}</span>
              </div>

              {/* Venmo pay button */}
              {receipt.paidByVenmo &&
               verifiedPersonId === selectedTab &&
               receipt.paidById !== selectedTab && (
                <Button
                  className="w-full mt-2"
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
            </CardContent>
          </Card>
        ) : isAllTab ? (
          /* All tab — per-person summary list */
          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-semibold text-base">Per Person Summary</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredPersonTotals.map(([personId, totals]) => {
                const person = getPersonById(personId);
                if (!person) return null;
                return (
                  <div key={personId} className="p-3 border rounded-lg space-y-1.5">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-8 h-8 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: getColorForPerson(personId) }}
                      >
                        {getInitials(person.name)}
                      </div>
                      <span className="font-semibold">{person.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>${totals.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tip</span>
                      <span>${totals.tip.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm pt-1 border-t">
                      <span>Total</span>
                      <span>${totals.total.toFixed(2)}</span>
                    </div>
                    {receipt.paidByVenmo &&
                     verifiedPersonId === personId &&
                     receipt.paidById !== personId && (
                      <Button
                        className="w-full mt-1"
                        onClick={() => {
                          const username = encodeURIComponent(receipt.paidByVenmo || "");
                          const amount = totals.total.toFixed(2);
                          const note = encodeURIComponent(`Tab Splits - ${receipt.restaurantName || 'Receipt'}`);
                          window.location.href = `venmo://paycharge?txn=pay&recipients=${username}&amount=${amount}&note=${note}`;
                        }}
                        data-testid={`button-pay-venmo-${personId}`}
                      >
                        Pay @{receipt.paidByVenmo} on Venmo
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        {/* Paid by banner */}
        {receipt.paidByName && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium">{receipt.paidByName} paid the bill</p>
                  {receipt.paidByVenmo && (
                    <p className="text-sm text-muted-foreground">Venmo: @{receipt.paidByVenmo}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Receipt total — All tab only */}
        {isAllTab && (
          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-semibold text-base">Receipt Total</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tip</span>
                <span>${tip.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
