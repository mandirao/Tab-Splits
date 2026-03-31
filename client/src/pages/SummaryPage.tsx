import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const { data: receipt } = useQuery<Receipt>({
    queryKey: ["/api/receipts", receiptId],
  });

  const { data: items = [] } = useQuery<ReceiptItem[]>({
    queryKey: ["/api/receipts", receiptId, "items"],
  });

  const { data: allPeople = [] } = useQuery<Person[]>({
    queryKey: ["/api/people"],
  });

  const calculatePersonSummaries = (): PersonSummary[] => {
    if (!receipt || items.length === 0 || allPeople.length === 0) {
      return [];
    }

    const tax = parseFloat(receipt.tax) || 0;
    const tip = parseFloat(receipt.tip) || 0;
    
    const peopleWithColors = allPeople.map((person, idx) => ({
      ...person,
      color: PERSON_COLORS[idx % PERSON_COLORS.length]
    }));

    const personSummaries: Map<string, PersonSummary> = new Map();
    
    peopleWithColors.forEach(person => {
      personSummaries.set(person.id, {
        id: person.id,
        name: person.name,
        initials: person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        color: person.color,
        items: [],
        subtotal: 0,
        taxShare: 0,
        tipShare: 0,
        total: 0
      });
    });

    items.forEach(item => {
      const assignedTo = (item.assignedTo as string[]) || [];
      if (assignedTo.length === 0) return;

      const itemPrice = parseFloat(item.price) || 0;
      const quantity = item.quantity || 1;
      const qtys = (item.assignedQuantities as Record<string, number>) || {};
      
      if (itemPrice <= 0) return;

      const totalAssignedQty = assignedTo.reduce((sum, pid) => sum + (qtys[pid] ?? 1), 0);

      assignedTo.forEach(personId => {
        const summary = personSummaries.get(personId);
        if (summary) {
          const personQty = qtys[personId] ?? 1;
          const personShare = totalAssignedQty > 0 ? (personQty / totalAssignedQty) * itemPrice : itemPrice / assignedTo.length;
          const displayQty = totalAssignedQty > 0 ? (personQty / totalAssignedQty) * quantity : quantity / assignedTo.length;
          summary.items.push({
            name: item.name,
            quantity: displayQty,
            price: personShare
          });
          summary.subtotal += personShare;
        }
      });
    });

    let totalSubtotal = 0;
    personSummaries.forEach(summary => {
      totalSubtotal += summary.subtotal;
    });

    personSummaries.forEach(summary => {
      if (totalSubtotal > 0) {
        summary.taxShare = (summary.subtotal / totalSubtotal) * tax;
        summary.tipShare = (summary.subtotal / totalSubtotal) * tip;
      }
      summary.total = summary.subtotal + summary.taxShare + summary.tipShare;
    });

    return Array.from(personSummaries.values()).filter(s => s.items.length > 0);
  };

  const peopleSummaries = calculatePersonSummaries();

  const handleShareAll = async () => {
    const summaryText = peopleSummaries
      .map(person => {
        const itemsText = person.items.map(item => 
          `  ${item.name} x${item.quantity.toFixed(2)}: $${item.price.toFixed(2)}`
        ).join('\n');
        return `${person.name}:\n${itemsText}\n  Subtotal: $${person.subtotal.toFixed(2)}\n  Tax: $${person.taxShare.toFixed(2)}\n  Tip: $${person.tipShare.toFixed(2)}\n  Total: $${person.total.toFixed(2)}`;
      })
      .join('\n\n');

    const fullText = `${receipt?.restaurantName || 'Receipt'} Summary\n\n${summaryText}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${receipt?.restaurantName || 'Receipt'} Summary`,
          text: fullText
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      await navigator.clipboard.writeText(fullText);
      toast({ title: "Copied to clipboard!" });
    }
  };

  const handleSharePerson = async (person: PersonSummary) => {
    const itemsText = person.items.map(item => 
      `  ${item.name} x${item.quantity.toFixed(2)}: $${item.price.toFixed(2)}`
    ).join('\n');
    
    const summaryText = `Your bill at ${receipt?.restaurantName || 'the restaurant'}:\n\n${itemsText}\n\nSubtotal: $${person.subtotal.toFixed(2)}\nTax: $${person.taxShare.toFixed(2)}\nTip: $${person.tipShare.toFixed(2)}\nTotal: $${person.total.toFixed(2)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Your bill - ${receipt?.restaurantName}`,
          text: summaryText
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      await navigator.clipboard.writeText(summaryText);
      toast({ title: "Copied to clipboard!" });
    }
  };

  if (!receipt) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading summary...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex-shrink-0 p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-3">
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

      <main className="flex-1 overflow-hidden">
        <Tabs defaultValue="all" className="h-full flex flex-col">
          <TabsList className="w-full rounded-none border-b bg-card px-4">
            <TabsTrigger value="all" className="flex-1" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="by-person" className="flex-1" data-testid="tab-by-person">By Person</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="flex-1 overflow-y-auto p-4 mt-0">
            {peopleSummaries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No items have been assigned yet</p>
                <p className="text-sm mt-2">Assign items to people to see the breakdown</p>
              </div>
            ) : (
              <div className="space-y-4">
                {peopleSummaries.map((person) => (
                  <PersonSummaryCard
                    key={person.id}
                    {...person}
                    onShare={() => handleSharePerson(person)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="by-person" className="flex-1 overflow-y-auto p-4 mt-0">
            {peopleSummaries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No items have been assigned yet</p>
                <p className="text-sm mt-2">Assign items to people to see the breakdown</p>
              </div>
            ) : (
              <div className="space-y-4">
                {peopleSummaries.map((person) => (
                  <PersonSummaryCard
                    key={person.id}
                    {...person}
                    onShare={() => handleSharePerson(person)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
