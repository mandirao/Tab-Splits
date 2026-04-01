import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Receipt, ReceiptItem, Person, Payment } from "@shared/schema";
import { ArrowLeft, Image, DollarSign } from "lucide-react";
import { useLocation } from "wouter";

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

export default function OrganizerViewPage({ params }: { params: { id: string } }) {
  const receiptId = params?.id || window.location.pathname.split('/')[2];
  const [, setLocation] = useLocation();
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const tabRowRef = useRef<HTMLDivElement>(null);

  const { data: receipt, isLoading: receiptLoading } = useQuery<Receipt>({
    queryKey: ["/api/receipts", receiptId],
  });

  const { data: items = [] } = useQuery<ReceiptItem[]>({
    queryKey: ["/api/receipts", receiptId, "items"],
  });

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ["/api/receipts", receiptId, "people"],
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/receipts", receiptId, "payments"],
  });

  // Scroll active tab into view
  useEffect(() => {
    if (!tabRowRef.current) return;
    const active = tabRowRef.current.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedTab]);

  const peopleWithColors = people.map((person, idx) => ({
    ...person,
    color: PERSON_COLORS[idx % PERSON_COLORS.length],
  }));

  const getPersonById = (id: string) => peopleWithColors.find(p => p.id === id);
  const getInitialsForPerson = (personId: string) => {
    const person = getPersonById(personId);
    if (!person) return "";
    return person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  const getColorForPerson = (personId: string) => getPersonById(personId)?.color || PERSON_COLORS[0];

  if (receiptLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading receipt...</p>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-lg font-semibold">Receipt not found</p>
        <Button onClick={() => setLocation("/")} data-testid="button-go-home">Go Home</Button>
      </div>
    );
  }

  const subtotal = parseFloat(receipt.subtotal) || 0;
  const tax = parseFloat(receipt.tax) || 0;
  const tip = parseFloat(receipt.tip) || 0;
  const total = subtotal + tax + tip;

  // Build per-person totals
  const personTotals = new Map<string, { subtotal: number; tax: number; tip: number; total: number }>();
  items.forEach(item => {
    const itemPrice = parseFloat(item.price) || 0;
    const assignedPeople = (item.assignedTo as string[]) || [];
    const qtys = (item.assignedQuantities as Record<string, number>) || {};
    if (assignedPeople.length === 0) return;
    const totalAssignedQty = assignedPeople.reduce((s, pid) => s + (qtys[pid] ?? 1), 0);
    assignedPeople.forEach(personId => {
      const personQty = qtys[personId] ?? 1;
      const personShare = totalAssignedQty > 0
        ? (personQty / totalAssignedQty) * itemPrice
        : itemPrice / assignedPeople.length;
      if (!personTotals.has(personId)) personTotals.set(personId, { subtotal: 0, tax: 0, tip: 0, total: 0 });
      personTotals.get(personId)!.subtotal += personShare;
    });
  });
  personTotals.forEach(t => {
    const proportion = subtotal > 0 ? t.subtotal / subtotal : 0;
    t.tax = tax * proportion;
    t.tip = tip * proportion;
    t.total = t.subtotal + t.tax + t.tip;
  });

  // Tab filtering
  const isAllTab = selectedTab === "all";
  const filteredItems = isAllTab
    ? items
    : items.filter(item => (item.assignedTo as string[] || []).includes(selectedTab));

  const filteredPersonTotals = isAllTab
    ? Array.from(personTotals.entries())
    : Array.from(personTotals.entries()).filter(([id]) => id === selectedTab);

  const myTotals = !isAllTab ? personTotals.get(selectedTab) : null;

  // Only show people who have assigned items in the tab row
  const peopleInTabs = peopleWithColors.filter(p => personTotals.has(p.id));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 border-b bg-card sticky top-0 z-50">
        <div className="flex items-center justify-between gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation(`/receipt/${receiptId}`)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{receipt.restaurantName || "Receipt"}</h1>
            <p className="text-sm text-muted-foreground">Summary View</p>
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

          {peopleInTabs.map(person => {
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
                        {assignedPeople.map((personId, idx) => (
                          <div
                            key={idx}
                            className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center ring-2 ring-background"
                            style={{ backgroundColor: getColorForPerson(personId) }}
                          >
                            {getInitialsForPerson(personId)}
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

        {/* Person-tab: single summary breakdown */}
        {!isAllTab && myTotals && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                  style={{ backgroundColor: getColorForPerson(selectedTab) }}
                >
                  {getInitialsForPerson(selectedTab)}
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
                <span data-testid={`text-person-total-${selectedTab}`}>${myTotals.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All tab: per-person summary list */}
        {isAllTab && filteredPersonTotals.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-semibold text-base">Per Person Summary</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredPersonTotals.map(([personId, totals]) => {
                const person = getPersonById(personId);
                if (!person) return null;
                return (
                  <div key={personId} className="p-3 border rounded-lg" data-testid={`person-summary-${personId}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: getColorForPerson(personId) }}
                      >
                        {getInitialsForPerson(personId)}
                      </div>
                      <span className="font-semibold" data-testid={`text-person-name-${personId}`}>{person.name}</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>${totals.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax</span>
                        <span>${totals.tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tip</span>
                        <span>${totals.tip.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold pt-1 border-t">
                        <span>Total</span>
                        <span data-testid={`text-person-total-${personId}`}>${totals.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Who Paid */}
        {payments.length > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Who Paid
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {payments.map(payment => {
                const payer = getPersonById(payment.personId);
                if (!payer) return null;
                return (
                  <div key={payment.id} className="flex items-center justify-between" data-testid={`payment-info-${payment.id}`}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: getColorForPerson(payment.personId) }}
                      >
                        {getInitialsForPerson(payment.personId)}
                      </div>
                      <div>
                        <p className="font-medium" data-testid={`text-payer-name-${payment.id}`}>{payer.name}</p>
                        {payer.venmoUsername && (
                          <button
                            className="text-xs text-primary hover:underline"
                            onClick={() => {
                              window.location.href = `venmo://users?username=${encodeURIComponent(payer.venmoUsername || "")}`;
                            }}
                            data-testid={`button-venmo-${payment.id}`}
                          >
                            @{payer.venmoUsername}
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-primary" data-testid={`text-payment-amount-${payment.id}`}>
                      ${parseFloat(payment.amount).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Receipt total — always visible */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="font-semibold text-base">Receipt Total</h2>
          </CardHeader>
          <CardContent className="space-y-2">
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
            <div className="flex justify-between text-xl font-bold pt-2 border-t">
              <span>Total</span>
              <span data-testid="text-receipt-total">${total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
