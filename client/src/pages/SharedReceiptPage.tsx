import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ReceiptItem } from "@shared/schema";
import { ArrowLeft, Image, DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedPersonId, setVerifiedPersonId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [showLinkOptions, setShowLinkOptions] = useState(false);
  const [unmatchedPeople, setUnmatchedPeople] = useState<RedactedPerson[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const { data, isLoading, error } = useQuery<SharedReceiptPayload>({
    queryKey: [`/api/share/${shareToken}`],
    enabled: isVerified,
  });

  const verifyPhoneMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return await apiRequest(`/api/share/${shareToken}/verify-phone`, "POST", { phone: phoneNumber });
    },
    onSuccess: (result: { verified: boolean; personId?: string; personName?: string; unmatchedPeople?: RedactedPerson[] }) => {
      if (result.verified) {
        setIsVerified(true);
        setVerifiedPersonId(result.personId || null);
        toast({
          title: "Access granted",
          description: `Welcome ${result.personName}!`
        });
      } else {
        setUnmatchedPeople(result.unmatchedPeople || []);
        setShowLinkOptions(true);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const linkPhoneMutation = useMutation({
    mutationFn: async (data: { phone: string; personId?: string; name?: string }) => {
      return await apiRequest(`/api/share/${shareToken}/link-phone`, "POST", data);
    },
    onSuccess: (result: { verified: boolean; personId: string; personName: string }) => {
      setIsVerified(true);
      setVerifiedPersonId(result.personId);
      setShowLinkOptions(false);
      toast({
        title: "Access granted",
        description: `Welcome ${result.personName}!`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Link failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleVerifyPhone = () => {
    if (!phone.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter your phone number",
        variant: "destructive"
      });
      return;
    }
    verifyPhoneMutation.mutate(phone);
  };

  const handleLinkToExisting = (personId: string) => {
    linkPhoneMutation.mutate({ phone, personId });
  };

  const handleCreateNew = () => {
    if (!newName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name",
        variant: "destructive"
      });
      return;
    }
    linkPhoneMutation.mutate({ phone, name: newName });
  };

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

  // Show phone verification screen if not verified
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h2 className="text-2xl font-bold text-center">Enter Your Phone Number</h2>
            <p className="text-sm text-muted-foreground text-center">
              To view this receipt, please verify your phone number
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showLinkOptions ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyPhone()}
                    data-testid="input-verify-phone"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleVerifyPhone}
                  disabled={verifyPhoneMutation.isPending}
                  data-testid="button-verify-phone"
                >
                  {verifyPhoneMutation.isPending ? "Verifying..." : "Continue"}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <p className="text-sm font-medium">Your phone number is not linked to anyone on this receipt.</p>
                  
                  {unmatchedPeople.length > 0 && (
                    <>
                      <p className="text-sm text-muted-foreground">Are you one of these people?</p>
                      <div className="space-y-2">
                        {unmatchedPeople.map((person) => (
                          <Button
                            key={person.id}
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => handleLinkToExisting(person.id)}
                            disabled={linkPhoneMutation.isPending}
                            data-testid={`button-link-person-${person.id}`}
                          >
                            {person.name}
                          </Button>
                        ))}
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">Or</span>
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-name">Enter your name</Label>
                    <Input
                      id="new-name"
                      type="text"
                      placeholder="Your name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
                      data-testid="input-new-name"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleCreateNew}
                    disabled={linkPhoneMutation.isPending}
                    data-testid="button-create-new-person"
                  >
                    {linkPhoneMutation.isPending ? "Linking..." : "Continue with this name"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setShowLinkOptions(false);
                      setPhone("");
                      setNewName("");
                    }}
                    data-testid="button-back-to-phone"
                  >
                    Use a different phone number
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

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
    const qtys = (item.assignedQuantities as Record<string, number>) || {};
    
    if (assignedPeople.length > 0) {
      const totalAssignedQty = assignedPeople.reduce((sum, pid) => sum + (qtys[pid] ?? 1), 0);
      assignedPeople.forEach(personId => {
        const personQty = qtys[personId] ?? 1;
        const personShare = totalAssignedQty > 0 ? (personQty / totalAssignedQty) * itemPrice : itemPrice / assignedPeople.length;
        if (!personTotals.has(personId)) {
          personTotals.set(personId, { subtotal: 0, tax: 0, tip: 0, total: 0 });
        }
        const current = personTotals.get(personId)!;
        current.subtotal += personShare;
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
        <div className="flex items-center justify-between">
          <div className="w-10" />
          <div className="text-center flex-1">
            <h1 className="text-xl font-bold">{receipt.restaurantName || "Receipt"}</h1>
            <p className="text-sm text-muted-foreground mt-1">Shared Receipt</p>
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
                  {/* Pay with Venmo button - only for the viewer's own total */}
                  {receipt.paidByVenmo && 
                   verifiedPersonId === personId && 
                   receipt.paidById !== personId && (
                    <Button
                      className="w-full mt-3"
                      onClick={() => {
                        const venmoUsername = encodeURIComponent(receipt.paidByVenmo || "");
                        const amount = totals.total.toFixed(2);
                        const note = encodeURIComponent(`SplitTab - ${receipt.restaurantName || 'Receipt'}`);
                        const venmoUrl = `venmo://paycharge?txn=pay&recipients=${venmoUsername}&amount=${amount}&note=${note}`;
                        window.location.href = venmoUrl;
                      }}
                      data-testid={`button-pay-venmo-${personId}`}
                    >
                      Pay ${totals.total.toFixed(2)} via Venmo
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Paid By Info */}
        {receipt.paidByName && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">
                    {receipt.paidByName} paid the bill
                  </p>
                  {receipt.paidByVenmo && (
                    <p className="text-sm text-muted-foreground">
                      Venmo: @{receipt.paidByVenmo}
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
