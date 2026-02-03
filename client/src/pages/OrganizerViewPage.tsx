import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Receipt, ReceiptItem, Person } from "@shared/schema";
import { ArrowLeft, Image, DollarSign } from "lucide-react";
import { useLocation } from "wouter";

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

  const { data: receipt, isLoading: receiptLoading } = useQuery<Receipt>({
    queryKey: ["/api/receipts", receiptId],
  });

  const { data: items = [] } = useQuery<ReceiptItem[]>({
    queryKey: ["/api/receipts", receiptId, "items"],
  });

  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ["/api/receipts", receiptId, "people"],
  });

  const peopleWithColors = people.map((person, idx) => ({
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
        <Button onClick={() => setLocation("/")} data-testid="button-go-home">
          Go Home
        </Button>
      </div>
    );
  }

  const subtotal = parseFloat(receipt.subtotal) || 0;
  const tax = parseFloat(receipt.tax) || 0;
  const tip = parseFloat(receipt.tip) || 0;
  const total = subtotal + tax + tip;

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

  personTotals.forEach((totals) => {
    const proportion = subtotal > 0 ? totals.subtotal / subtotal : 0;
    totals.tax = tax * proportion;
    totals.tip = tip * proportion;
    totals.total = totals.subtotal + totals.tax + totals.tip;
  });

  const paidByPerson = receipt.paidById ? getPersonById(receipt.paidById) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => setLocation(`/receipt/${receiptId}`)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center flex-1">
            <h1 className="text-xl font-bold">{receipt.restaurantName || "Receipt"}</h1>
            <p className="text-sm text-muted-foreground mt-1">Summary View</p>
          </div>
          {receipt.imageUrl && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" data-testid="button-view-receipt-image">
                  <Image className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto">
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
          )}
          {!receipt.imageUrl && <div className="w-10" />}
        </div>
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
                  data-testid={`item-row-${item.id}`}
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
                <div key={personId} className="p-3 border rounded-lg" data-testid={`person-summary-${personId}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-full text-white text-xs font-semibold flex items-center justify-center"
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

        {paidByPerson && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium" data-testid="text-paid-by">
                    {paidByPerson.name} paid the bill
                  </p>
                  {paidByPerson.venmoUsername && (
                    <p className="text-sm text-muted-foreground" data-testid="text-venmo-username">
                      Venmo: @{paidByPerson.venmoUsername}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
