import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Receipt, ReceiptItem, Person, Payment } from "@shared/schema";
import { getPersonTotals } from "@shared/splitMath";
import { useLocation } from "wouter";
import { getDisplayNames } from "@/lib/personDisplay";
import { firstNameOnly, getPeopleWithColors } from "@/lib/receiptSummary";
import ReceiptSummaryItemRow from "@/components/ReceiptSummaryItemRow";
import ReceiptSummaryTabRow from "@/components/ReceiptSummaryTabRow";
import ReceiptSummaryTotalsRows from "@/components/ReceiptSummaryTotalsRows";
import ReceiptPhotoDialog from "@/components/ReceiptPhotoDialog";
import VenmoPayButton from "@/components/VenmoPayButton";

export default function OrganizerViewPage({ params }: { params: { id: string } }) {
  const receiptId = params?.id || window.location.pathname.split('/')[2];
  const [, setLocation] = useLocation();
  const [selectedTab, setSelectedTab] = useState<string>("all");

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

  const { peopleWithColors, getPersonById, getColorForPerson, getInitialsForPerson } = getPeopleWithColors(people);

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

  const personTotals = getPersonTotals(items, { subtotal, tax, tip });

  const payer = receipt.paidById ? people.find(p => p.id === receipt.paidById) : null;
  const payerVenmo = payer?.venmoUsername || null;

  const isAllTab = selectedTab === "all";
  const filteredItems = isAllTab
    ? items
    : items.filter(item => (item.assignedTo as string[] || []).includes(selectedTab));

  const myTotals = !isAllTab ? personTotals.get(selectedTab) : null;
  const selectedPerson = !isAllTab ? getPersonById(selectedTab) : null;

  const peopleInTabs = peopleWithColors.filter(p => personTotals.has(p.id));
  const displayNames = getDisplayNames(peopleInTabs);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 border-b bg-card sticky top-0 z-50">
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLocation(`/receipt/${receiptId}`)}
            data-testid="button-back"
          >
            Edit tab
          </Button>
          <div className="text-center flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{receipt.restaurantName || "Receipt"}</h1>
            <p className="text-sm text-muted-foreground">Summary</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ThemeToggle />
            <ReceiptPhotoDialog imageUrl={receipt.imageUrl} />
          </div>
        </div>
      </header>

      <ReceiptSummaryTabRow
        people={peopleInTabs}
        displayNames={displayNames}
        selectedTab={selectedTab}
        onSelectTab={setSelectedTab}
      />

      <main className="p-4 pb-24 space-y-3">

        {/* Items card — totals appended at bottom for person tabs */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="font-semibold text-base">
              {isAllTab ? "Items" : `${firstNameOnly(selectedPerson?.name ?? "")}'s Items`}
            </h2>
          </CardHeader>

          <CardContent className="p-0">
            <div className="px-4">
              {filteredItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">No items assigned.</p>
              ) : (
                filteredItems.map(item => (
                  <ReceiptSummaryItemRow
                    key={item.id}
                    item={item}
                    isAllTab={isAllTab}
                    selectedTab={selectedTab}
                    getColorForPerson={getColorForPerson}
                    getInitialsForPerson={getInitialsForPerson}
                  />
                ))
              )}
            </div>

            {/* Person-tab totals — connected at the bottom of the items card */}
            {!isAllTab && myTotals && (
              <div className="border-t mx-0 px-4 pt-3 pb-4 space-y-2 mt-1">
                <ReceiptSummaryTotalsRows
                  subtotal={myTotals.subtotal}
                  tax={myTotals.tax}
                  tip={myTotals.tip}
                  total={myTotals.total}
                  totalTestId={`text-person-total-${selectedTab}`}
                />

                {payerVenmo && selectedTab !== receipt.paidById && (
                  <VenmoPayButton
                    venmoUsername={payerVenmo}
                    amount={myTotals.total}
                    restaurantName={receipt.restaurantName ?? ""}
                    testId={`button-pay-venmo-${selectedTab}`}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All tab: Receipt total + who paid — one unified card */}
        {isAllTab && (
          <Card>
            <CardContent className="pt-4 space-y-2">
              <ReceiptSummaryTotalsRows
                subtotal={subtotal}
                tax={tax}
                tip={tip}
                total={total}
                totalTestId="text-receipt-total"
                subtotalTestId="text-receipt-subtotal"
                taxTestId="text-receipt-tax"
                tipTestId="text-receipt-tip"
              />

              {/* Who paid — slim inline row */}
              {payments.map(payment => {
                const payerPerson = getPersonById(payment.personId);
                if (!payerPerson) return null;
                const fullPerson = people.find(p => p.id === payment.personId);
                return (
                  <div
                    key={payment.id}
                    className="flex items-center gap-2 pt-2 border-t"
                    data-testid={`payment-info-${payment.id}`}
                  >
                    <div
                      className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                      style={{ backgroundColor: getColorForPerson(payment.personId) }}
                    >
                      {getInitialsForPerson(payment.personId)}
                    </div>
                    <span className="text-sm font-medium" data-testid={`text-payer-name-${payment.id}`}>
                      {firstNameOnly(payerPerson.name)} paid
                    </span>
                    {fullPerson?.venmoUsername && (
                      <button
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => {
                          window.location.href = `venmo://users?username=${encodeURIComponent(fullPerson.venmoUsername || "")}`;
                        }}
                        data-testid={`button-venmo-${payment.id}`}
                      >
                        @{fullPerson.venmoUsername}
                      </button>
                    )}
                    <span className="ml-auto text-sm font-semibold" data-testid={`text-payment-amount-${payment.id}`}>
                      ${parseFloat(payment.amount).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
