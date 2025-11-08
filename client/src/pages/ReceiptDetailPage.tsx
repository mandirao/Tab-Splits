import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ReceiptItemRow from "@/components/ReceiptItemRow";
import TipCalculator from "@/components/TipCalculator";
import BottomSheet from "@/components/BottomSheet";
import PersonChip from "@/components/PersonChip";
import { ArrowLeft, Users, Share2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Receipt, ReceiptItem, Person } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface PersonWithColor extends Person {
  color: string;
}

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

export default function ReceiptDetailPage({ params }: { params: { id: string } }) {
  const receiptId = params?.id || window.location.pathname.split('/')[2];
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [assignBottomSheetOpen, setAssignBottomSheetOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [tipPercentage, setTipPercentage] = useState(20);

  const { data: receipt } = useQuery<Receipt>({
    queryKey: ["/api/receipts", receiptId],
  });

  const { data: items = [] } = useQuery<ReceiptItem[]>({
    queryKey: ["/api/receipts", receiptId, "items"],
  });

  const { data: allPeople = [] } = useQuery<Person[]>({
    queryKey: ["/api/people"],
  });

  const peopleWithColors: PersonWithColor[] = allPeople.map((person, idx) => ({
    ...person,
    color: PERSON_COLORS[idx % PERSON_COLORS.length]
  }));

  const subtotal = receipt ? parseFloat(receipt.subtotal) : 0;
  const tax = receipt ? parseFloat(receipt.tax) : 0;
  const tipAmount = receipt ? parseFloat(receipt.tip) : subtotal * 0.2;
  const total = subtotal + tax + tipAmount;

  useEffect(() => {
    if (receipt && tipPercentage !== (parseFloat(receipt.tip) / subtotal * 100)) {
      setTipPercentage((parseFloat(receipt.tip) / subtotal) * 100);
    }
  }, [receipt]);

  const updateReceiptMutation = useMutation({
    mutationFn: async (data: { tip: number }) => {
      return await apiRequest(`/api/receipts/${receiptId}`, "PATCH", {
        tip: data.tip.toFixed(2),
        total: (subtotal + tax + data.tip).toFixed(2)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, assignedTo }: { itemId: string; assignedTo: string[] }) => {
      return await apiRequest(`/api/items/${itemId}`, "PATCH", { assignedTo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
      toast({ title: "Assignment saved" });
    }
  });

  const handleTipChange = (amount: number) => {
    updateReceiptMutation.mutate({ tip: amount });
  };

  const handleAssignClick = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    setSelectedItemId(itemId);
    setSelectedPeople((item?.assignedTo as string[]) || []);
    setAssignBottomSheetOpen(true);
  };

  const handleSaveAssignment = () => {
    if (selectedItemId) {
      updateItemMutation.mutate({
        itemId: selectedItemId,
        assignedTo: selectedPeople
      });
    }
    setAssignBottomSheetOpen(false);
    setSelectedItemId(null);
    setSelectedPeople([]);
  };

  const togglePersonSelection = (personId: string) => {
    setSelectedPeople(prev => 
      prev.includes(personId)
        ? prev.filter(id => id !== personId)
        : [...prev, personId]
    );
  };

  const getPersonById = (id: string) => peopleWithColors.find(p => p.id === id);
  const getInitialsForPerson = (personId: string) => {
    const person = getPersonById(personId);
    if (!person) return "";
    return person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  const getColorForPerson = (personId: string) => getPersonById(personId)?.color || PERSON_COLORS[0];

  if (!receipt) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading receipt...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex-shrink-0 p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-3">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold flex-1 text-center">{receipt.restaurantName || "Receipt"}</h1>
          <Button 
            size="icon" 
            variant="ghost"
            onClick={() => console.log('Share receipt')}
            data-testid="button-share-receipt"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {peopleWithColors.length} people
          </Badge>
          <Badge variant="outline">{items.length} items</Badge>
          <Badge variant={items.every(i => (i.assignedTo as string[] || []).length > 0) ? "default" : "secondary"}>
            {items.filter(i => (i.assignedTo as string[] || []).length > 0).length}/{items.length} assigned
          </Badge>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32">
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <h2 className="font-semibold text-base">Items</h2>
          </CardHeader>
          <CardContent className="divide-y">
            {items.map((item) => (
              <ReceiptItemRow
                key={item.id}
                id={item.id}
                name={item.name}
                quantity={item.quantity || 1}
                price={parseFloat(item.price)}
                assignedInitials={(item.assignedTo as string[] || []).map(getInitialsForPerson)}
                assignedColors={(item.assignedTo as string[] || []).map(getColorForPerson)}
                onAssign={() => handleAssignClick(item.id)}
                onEdit={() => console.log('Edit item', item.id)}
              />
            ))}
          </CardContent>
        </Card>

        <TipCalculator
          subtotal={subtotal}
          tipPercentage={tipPercentage}
          tipAmount={tipAmount}
          onTipPercentageChange={setTipPercentage}
          onTipAmountChange={handleTipChange}
        />
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4">
        <div className="space-y-3 mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span data-testid="text-receipt-subtotal">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span data-testid="text-receipt-tax">${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tip ({tipPercentage.toFixed(0)}%)</span>
            <span data-testid="text-receipt-tip">${tipAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold pt-2 border-t">
            <span>Total</span>
            <span data-testid="text-receipt-total">${total.toFixed(2)}</span>
          </div>
        </div>
        
        <Button 
          className="w-full h-12"
          onClick={() => setLocation(`/receipt/${receiptId}/summary`)}
          data-testid="button-view-summary"
        >
          View Summary
        </Button>
      </div>

      <BottomSheet
        open={assignBottomSheetOpen}
        onClose={() => {
          setAssignBottomSheetOpen(false);
          setSelectedPeople([]);
        }}
        title="Assign to People"
        footer={
          <Button 
            className="w-full" 
            onClick={handleSaveAssignment}
            data-testid="button-save-assignment"
          >
            Save Assignment
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select one or more people to assign this item to
          </p>
          <div className="flex flex-wrap gap-2">
            {peopleWithColors.map((person) => (
              <PersonChip
                key={person.id}
                name={person.name}
                initials={person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                color={person.color}
                selected={selectedPeople.includes(person.id)}
                onSelect={() => togglePersonSelection(person.id)}
              />
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
