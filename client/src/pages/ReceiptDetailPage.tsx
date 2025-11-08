import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ReceiptItemRow from "@/components/ReceiptItemRow";
import TipCalculator from "@/components/TipCalculator";
import BottomSheet from "@/components/BottomSheet";
import PersonChip from "@/components/PersonChip";
import { ArrowLeft, Users, Share2 } from "lucide-react";
import { useLocation } from "wouter";

interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  assignedTo: string[];
}

interface Person {
  id: string;
  name: string;
  initials: string;
}

export default function ReceiptDetailPage() {
  const [, setLocation] = useLocation();
  const [assignBottomSheetOpen, setAssignBottomSheetOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [tipPercentage, setTipPercentage] = useState(20);
  const [tipAmount, setTipAmount] = useState(25.50);

  const mockPeople: Person[] = [
    { id: "1", name: "John Doe", initials: "JD" },
    { id: "2", name: "Sarah Miller", initials: "SM" },
    { id: "3", name: "Alex Brown", initials: "AB" },
    { id: "4", name: "Emma Wilson", initials: "EW" }
  ];

  const [items, setItems] = useState<ReceiptItem[]>([
    { id: "1", name: "Margherita Pizza", quantity: 2, price: 24.00, assignedTo: ["1", "2"] },
    { id: "2", name: "Caesar Salad", quantity: 1, price: 12.50, assignedTo: ["3"] },
    { id: "3", name: "Garlic Bread", quantity: 1, price: 6.00, assignedTo: [] },
    { id: "4", name: "House Wine", quantity: 2, price: 16.00, assignedTo: ["1", "4"] },
    { id: "5", name: "Tiramisu", quantity: 1, price: 8.00, assignedTo: [] }
  ]);

  const subtotal = 127.50;
  const tax = 11.48;
  const total = subtotal + tax + tipAmount;

  const handleAssignClick = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    setSelectedItemId(itemId);
    setSelectedPeople(item?.assignedTo || []);
    setAssignBottomSheetOpen(true);
  };

  const handleSaveAssignment = () => {
    if (selectedItemId) {
      setItems(items.map(item => 
        item.id === selectedItemId 
          ? { ...item, assignedTo: selectedPeople }
          : item
      ));
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

  const getInitialsForPerson = (personId: string) => {
    return mockPeople.find(p => p.id === personId)?.initials || "";
  };

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
          <h1 className="text-xl font-bold flex-1 text-center">The Italian Kitchen</h1>
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
            {mockPeople.length} people
          </Badge>
          <Badge variant="outline">{items.length} items</Badge>
          <Badge variant={items.every(i => i.assignedTo.length > 0) ? "default" : "secondary"}>
            {items.filter(i => i.assignedTo.length > 0).length}/{items.length} assigned
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
                {...item}
                assignedInitials={item.assignedTo.map(getInitialsForPerson)}
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
          onTipAmountChange={setTipAmount}
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
            <span className="text-muted-foreground">Tip ({tipPercentage}%)</span>
            <span data-testid="text-receipt-tip">${tipAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold pt-2 border-t">
            <span>Total</span>
            <span data-testid="text-receipt-total">${total.toFixed(2)}</span>
          </div>
        </div>
        
        <Button 
          className="w-full h-12"
          onClick={() => setLocation('/receipt/1/summary')}
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
            {mockPeople.map((person) => (
              <PersonChip
                key={person.id}
                name={person.name}
                initials={person.initials}
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
