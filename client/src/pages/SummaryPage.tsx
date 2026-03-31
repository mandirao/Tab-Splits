import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import PersonSummaryCard from "@/components/PersonSummaryCard";
import { ArrowLeft, Share2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Receipt, ReceiptItem, Person } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

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

interface PersonSummary {
  id: string;
  name: string;
  initials: string;
  color: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  taxShare: number;
  tipShare: number;
  total: number;
}

export default function SummaryPage({ params }: { params?: { id?: string } }) {
  const receiptId = params?.id || window.location.pathname.split('/')[2];
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const tabRowRef = useRef<HTMLDivElement>(null);

  const { data: receipt } = useQuery<Receipt>({
    queryKey: ["/api/receipts", receiptId],
  });

  const { data: items = [] } = useQuery<ReceiptItem[]>({
    queryKey: ["/api/receipts", receiptId, "items"],
  });

  const { data: allPeople = [] } = useQuery<Person[]>({
    queryKey: ["/api/people"],
  });

  // Scroll active tab into view
  useEffect(() => {
    if (!tabRowRef.current) return;
    const active = tabRowRef.current.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedTab]);

  const calculatePersonSummaries = (): PersonSummary[] => {
    if (!receipt || items.length === 0 || allPeople.length === 0) return [];

    const tax = parseFloat(receipt.tax) || 0;
    const tip = parseFloat(receipt.tip) || 0;

    const peopleWithColors = allPeople.map((person, idx) => ({
      ...person,
      color: PERSON_COLORS[idx % PERSON_COLORS.length],
    }));

    const summaries = new Map<string, PersonSummary>();
    peopleWithColors.forEach(person => {
      summaries.set(person.id, {
        id: person.id,
        name: person.name,
        initials: person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        color: person.color,
        items: [],
        subtotal: 0,
        taxShare: 0,
        tipShare: 0,
        total: 0,
      });
    });

    items.forEach(item => {
      const assignedTo = (item.assignedTo as string[]) || [];
      if (assignedTo.length === 0) return;
      const itemPrice = parseFloat(item.price) || 0;
      const quantity = item.quantity || 1;
      const qtys = (item.assignedQuantities as Record<string, number>) || {};
      if (itemPrice <= 0) return;
      const totalAssignedQty = assignedTo.reduce((s, pid) => s + (qtys[pid] ?? 1), 0);
      assignedTo.forEach(personId => {
        const s = summaries.get(personId);
        if (!s) return;
        const personQty = qtys[personId] ?? 1;
        const personShare = totalAssignedQty > 0
          ? (personQty / totalAssignedQty) * itemPrice
          : itemPrice / assignedTo.length;
        const displayQty = totalAssignedQty > 0
          ? (personQty / totalAssignedQty) * quantity
          : quantity / assignedTo.length;
        s.items.push({ name: item.name, quantity: displayQty, price: personShare });
        s.subtotal += personShare;
      });
    });

    let totalSubtotal = 0;
    summaries.forEach(s => { totalSubtotal += s.subtotal; });
    summaries.forEach(s => {
      if (totalSubtotal > 0) {
        s.taxShare = (s.subtotal / totalSubtotal) * tax;
        s.tipShare = (s.subtotal / totalSubtotal) * tip;
      }
      s.total = s.subtotal + s.taxShare + s.tipShare;
    });

    return Array.from(summaries.values()).filter(s => s.items.length > 0);
  };

  const peopleSummaries = calculatePersonSummaries();

  const handleShareAll = async () => {
    const summaryText = peopleSummaries
      .map(p => {
        const lines = p.items.map(i => `  ${i.name} x${i.quantity.toFixed(2)}: $${i.price.toFixed(2)}`).join('\n');
        return `${p.name}:\n${lines}\n  Subtotal: $${p.subtotal.toFixed(2)}\n  Tax: $${p.taxShare.toFixed(2)}\n  Tip: $${p.tipShare.toFixed(2)}\n  Total: $${p.total.toFixed(2)}`;
      })
      .join('\n\n');
    const fullText = `${receipt?.restaurantName || 'Receipt'} Summary\n\n${summaryText}`;
    if (navigator.share) {
      try { await navigator.share({ title: `${receipt?.restaurantName || 'Receipt'} Summary`, text: fullText }); }
      catch {}
    } else {
      await navigator.clipboard.writeText(fullText);
      toast({ title: "Copied to clipboard!" });
    }
  };

  const handleSharePerson = async (person: PersonSummary) => {
    const lines = person.items.map(i => `  ${i.name} x${i.quantity.toFixed(2)}: $${i.price.toFixed(2)}`).join('\n');
    const text = `Your bill at ${receipt?.restaurantName || 'the restaurant'}:\n\n${lines}\n\nSubtotal: $${person.subtotal.toFixed(2)}\nTax: $${person.taxShare.toFixed(2)}\nTip: $${person.tipShare.toFixed(2)}\nTotal: $${person.total.toFixed(2)}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Your bill - ${receipt?.restaurantName}`, text }); }
      catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!" });
    }
  };

  if (!receipt) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading summary…</p>
      </div>
    );
  }

  const isAllTab = selectedTab === "all";
  const visibleSummaries = isAllTab
    ? peopleSummaries
    : peopleSummaries.filter(p => p.id === selectedTab);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex-shrink-0 p-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setLocation(`/receipt/${receiptId}`)}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Summary</h1>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleShareAll}
            data-testid="button-share-all"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Tab row */}
      <div className="flex-shrink-0 border-b bg-background">
        <div
          ref={tabRowRef}
          className="flex overflow-x-auto scrollbar-hide px-3 py-2 gap-2"
        >
          {/* All pill */}
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

          {/* Per-person pills */}
          {peopleSummaries.map(person => {
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

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {visibleSummaries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No items have been assigned yet</p>
            <p className="text-sm mt-2">Assign items to people to see the breakdown</p>
          </div>
        ) : (
          visibleSummaries.map(person => (
            <PersonSummaryCard
              key={person.id}
              {...person}
              onShare={() => handleSharePerson(person)}
            />
          ))
        )}
      </main>
    </div>
  );
}
