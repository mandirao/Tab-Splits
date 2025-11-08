import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReceiptItem } from "@shared/schema";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

interface SharedReceiptPayload {
  receipt: RedactedReceipt;
  items: ReceiptItem[];
  people: RedactedPerson[];
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

export default function SharedReceiptPage({ params }: { params: { token: string } }) {
  const shareToken = params?.token || window.location.pathname.split('/').pop();

  const { data, isLoading, error } = useQuery<SharedReceiptPayload>({
    queryKey: [`/api/share/${shareToken}`],
  });

  const receipt = data?.receipt;
  const items = data?.items || [];
  const allPeople = data?.people || [];

  const peopleWithColors = allPeople.map((person, idx) => ({
    ...person,
    color: PERSON_COLORS[idx % PERSON_COLORS.length]
  }));

  const getPersonById = (id: string) => peopleWithColors.find(p => p.id === id);
  const getInitialsForPerson = (personId: string) => {
    const person = getPersonById(personId);
    if (!person) return "";
    return person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  const getColorForPerson = (personId: string) => getPersonById(personId)?.color || PERSON_COLORS[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading receipt...</p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-lg font-semibold">Receipt not found</p>
        <p className="text-sm text-muted-foreground">
          {error ? "Failed to load the receipt. Please try again." : "This share link may have expired or is invalid"}
        </p>
      </div>
    );
  }

  const subtotal = parseFloat(receipt.subtotal) || 0;
  const tax = parseFloat(receipt.tax) || 0;
  const tip = parseFloat(receipt.tip) || 0;
  const total = subtotal + tax + tip;

  // Calculate per-person totals
  const personTotals = new Map<string, { subtotal: number; tax: number; tip: number; total: number }>();

  items.forEach(item => {
    const itemPrice = parseFloat(item.price) || 0;
    const assignedPeople = (item.assignedTo as string[]) || [];
    
    if (assignedPeople.length > 0) {
      const pricePerPerson = itemPrice / assignedPeople.length;
      
      assignedPeople.forEach(personId => {
        if (!personTotals.has(personId)) {
          personTotals.set(personId, { subtotal: 0, tax: 0, tip: 0, total: 0 });
        }
        const current = personTotals.get(personId)!;
        current.subtotal += pricePerPerson;
      });
    }
  });

  personTotals.forEach((totals, personId) => {
    const proportion = totals.subtotal / subtotal;
    totals.tax = tax * proportion;
    totals.tip = tip * proportion;
    totals.total = totals.subtotal + totals.tax + totals.tip;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 border-b bg-card sticky top-0 z-10">
        <h1 className="text-xl font-bold text-center">{receipt.restaurantName || "Receipt"}</h1>
        <p className="text-sm text-center text-muted-foreground mt-1">Shared Receipt</p>
      </header>

      <main className="p-4 pb-24 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <h2 className="font-semibold text-base">Items</h2>
          </CardHeader>
          <CardContent className="divide-y">
            {items.map((item) => {
              const isAssigned = (item.assignedTo as string[] || []).length > 0;
              return (
                <div 
                  key={item.id}
                  className={`flex items-center gap-3 py-3 ${!isAssigned ? 'opacity-60' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      {(item.quantity || 1) > 1 && (
                        <Badge variant="outline" className="text-xs px-1.5">
                          {item.quantity}x
                        </Badge>
                      )}
                      <span className="font-medium text-sm">{item.name}</span>
                    </div>
                    <span className="text-base font-semibold">
                      ${(parseFloat(item.price) || 0).toFixed(2)}
                    </span>
                  </div>
                  
                  {isAssigned && (
                    <div className="flex -space-x-1">
                      {(item.assignedTo as string[]).map((personId, idx) => (
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
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <h2 className="font-semibold text-base">Per Person Summary</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from(personTotals.entries()).map(([personId, totals]) => {
              const person = getPersonById(personId);
              if (!person) return null;
              
              return (
                <div key={personId} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-full text-white text-xs font-semibold flex items-center justify-center"
                      style={{ backgroundColor: getColorForPerson(personId) }}
                    >
                      {getInitialsForPerson(personId)}
                    </div>
                    <span className="font-semibold">{person.name}</span>
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
                      <span>${totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

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
      </main>
    </div>
  );
}
