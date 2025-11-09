import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ReceiptItemRow from "@/components/ReceiptItemRow";
import TipCalculator from "@/components/TipCalculator";
import BottomSheet from "@/components/BottomSheet";
import PersonChip from "@/components/PersonChip";
import { ArrowLeft, Users, Share2, QrCode, MessageSquare, Pencil } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Receipt, ReceiptItem, Person } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import QRCodeLib from "qrcode";

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
  const [editBottomSheetOpen, setEditBottomSheetOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [editItemData, setEditItemData] = useState({ name: "", quantity: 1, price: "" });
  const [showAddPersonForm, setShowAddPersonForm] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonPhone, setNewPersonPhone] = useState("");
  const [shareBottomSheetOpen, setShareBottomSheetOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [activeShareToken, setActiveShareToken] = useState<string | null>(null);
  const [tipPercentage, setTipPercentage] = useState(20);
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [tipBottomSheetOpen, setTipBottomSheetOpen] = useState(false);

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

  const subtotal = receipt ? (parseFloat(receipt.subtotal) || 0) : 0;
  const tax = receipt ? (parseFloat(receipt.tax) || 0) : 0;
  const tipAmount = receipt ? (parseFloat(receipt.tip) || 0) : subtotal * 0.2;
  const total = subtotal + tax + tipAmount;

  useEffect(() => {
    if (receipt && subtotal > 0) {
      const calculatedTipPercentage = ((parseFloat(receipt.tip) || 0) / subtotal) * 100;
      if (isFinite(calculatedTipPercentage) && tipPercentage !== calculatedTipPercentage) {
        setTipPercentage(calculatedTipPercentage);
      }
    }
  }, [receipt, subtotal]);

  useEffect(() => {
    if (receipt?.shareToken) {
      setActiveShareToken(receipt.shareToken);
    }
  }, [receipt?.shareToken]);

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
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to save assignment", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const updateItemDetailsMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: { name: string; quantity: number; price: string } }) => {
      return await apiRequest(`/api/items/${itemId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
      toast({ title: "Item updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update item", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const createPersonMutation = useMutation({
    mutationFn: async (data: { name: string; phone?: string }) => {
      return await apiRequest("/api/people", "POST", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setSelectedPeople(prev => [...prev, data.id]);
      setNewPersonName("");
      setNewPersonPhone("");
      setShowAddPersonForm(false);
      toast({ title: "Person added" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add person", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const generateShareTokenMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/receipts/${receiptId}/generate-share-token`, "POST", {});
    },
    onSuccess: async (data: { shareToken: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
      setActiveShareToken(data.shareToken);
      const shareUrl = `${window.location.origin}/share/${data.shareToken}`;
      try {
        const qrDataUrl = await QRCodeLib.toDataURL(shareUrl);
        setQrCodeDataUrl(qrDataUrl);
        toast({ 
          title: "Share link ready",
          description: "QR code generated successfully"
        });
      } catch (qrError) {
        toast({ 
          title: "QR code generation failed", 
          description: "Share link is available but QR code could not be generated",
          variant: "destructive" 
        });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to generate share link", 
        description: error.message,
        variant: "destructive" 
      });
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

  const handleEditClick = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setSelectedItemId(itemId);
      setEditItemData({
        name: item.name,
        quantity: item.quantity || 1,
        price: item.price
      });
      setEditBottomSheetOpen(true);
    }
  };

  const handleSaveEdit = () => {
    if (selectedItemId && editItemData.name && editItemData.price) {
      updateItemDetailsMutation.mutate({
        itemId: selectedItemId,
        data: editItemData
      });
      setEditBottomSheetOpen(false);
      setSelectedItemId(null);
      setEditItemData({ name: "", quantity: 1, price: "" });
    }
  };

  const handleAddNewPerson = () => {
    if (newPersonName.trim()) {
      const personData = {
        name: newPersonName.trim(),
        ...(newPersonPhone.trim() && { phone: newPersonPhone.trim() })
      };
      createPersonMutation.mutate(personData);
    }
  };

  const handleSelectFromContacts = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'tel'];
        const opts = { multiple: false };
        const contacts = await (navigator as any).contacts.select(props, opts);
        
        if (contacts && contacts.length > 0) {
          const contact = contacts[0];
          if (contact.name && contact.name.length > 0) {
            setNewPersonName(contact.name[0]);
          }
          if (contact.tel && contact.tel.length > 0) {
            setNewPersonPhone(contact.tel[0]);
          }
        }
      } catch (error) {
        console.error('Error selecting contact:', error);
        toast({
          title: "Could not access contacts",
          description: "Please enter the name manually",
          variant: "destructive"
        });
      }
    }
  };

  const handleShareClick = async () => {
    setShareBottomSheetOpen(true);
    if (!activeShareToken) {
      await generateShareTokenMutation.mutateAsync();
    } else {
      const shareUrl = `${window.location.origin}/share/${activeShareToken}`;
      const qrDataUrl = await QRCodeLib.toDataURL(shareUrl);
      setQrCodeDataUrl(qrDataUrl);
    }
  };

  const handleSendSMS = (personId: string) => {
    const person = getPersonById(personId);
    if (!person || !person.phone) {
      toast({
        title: "Cannot send SMS",
        description: "This person doesn't have a phone number",
        variant: "destructive"
      });
      return;
    }
    
    if (!activeShareToken) {
      toast({
        title: "Share link not ready",
        description: "Please wait for the share link to be generated",
        variant: "destructive"
      });
      return;
    }
    
    const shareUrl = `${window.location.origin}/share/${activeShareToken}`;
    const message = `Check out our bill at ${receipt?.restaurantName || 'the restaurant'}! ${shareUrl}`;
    window.location.href = `sms:${person.phone}?body=${encodeURIComponent(message)}`;
    
    toast({
      title: "Opening SMS app",
      description: `Sending share link to ${person.name}`
    });
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
    const proportion = subtotal > 0 ? totals.subtotal / subtotal : 0;
    totals.tax = tax * proportion;
    totals.tip = tipAmount * proportion;
    totals.total = totals.subtotal + totals.tax + totals.tip;
  });

  // Check if there are unassigned items
  const hasUnassignedItems = items.some(item => (item.assignedTo as string[] || []).length === 0);

  // Filter items based on selected tab
  const filteredItems = selectedTab === "all" 
    ? items 
    : selectedTab === "unassigned"
    ? items.filter(item => (item.assignedTo as string[] || []).length === 0)
    : items.filter(item => {
        const assignedPeople = (item.assignedTo as string[]) || [];
        return assignedPeople.includes(selectedTab);
      });

  // Calculate adjusted quantity for person-specific tabs
  const getAdjustedQuantity = (item: ReceiptItem, personId: string) => {
    const assignedPeople = (item.assignedTo as string[]) || [];
    const originalQuantity = item.quantity || 1;
    
    if (assignedPeople.length === 0) {
      return originalQuantity;
    }
    
    return originalQuantity / assignedPeople.length;
  };

  // Format quantity for display (handle fractions)
  const formatQuantity = (quantity: number): string => {
    if (Number.isInteger(quantity)) {
      return quantity.toString();
    }
    
    const whole = Math.floor(quantity);
    const fractionalPart = quantity - whole;
    
    // Try common denominators (2, 3, 4, 5, 6, 8)
    const denominators = [2, 3, 4, 5, 6, 8];
    
    for (const denom of denominators) {
      const numer = Math.round(fractionalPart * denom);
      const reconstructed = numer / denom;
      
      // Check if this fraction exactly represents the value (very tight tolerance)
      if (Math.abs(reconstructed - fractionalPart) < 1e-9 && numer > 0 && numer < denom) {
        if (whole === 0) {
          return `${numer}/${denom}`;
        } else {
          return `${whole} ${numer}/${denom}`;
        }
      }
    }
    
    // Fall back to decimal if no simple fraction works
    return quantity.toFixed(2);
  };

  // Determine which totals to display in sticky summary
  const isPersonTab = selectedTab !== "all" && selectedTab !== "unassigned";
  const displayTotals = isPersonTab && personTotals.has(selectedTab)
    ? personTotals.get(selectedTab)!
    : { subtotal, tax, tip: tipAmount, total };

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
            onClick={handleShareClick}
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

      {/* Horizontal Tabs */}
      <div className="flex-shrink-0 border-b bg-card overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 p-2 min-w-max">
          <Button
            variant={selectedTab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedTab("all")}
            className="whitespace-nowrap"
            data-testid="tab-all-items"
          >
            All Items
          </Button>
          
          {hasUnassignedItems && (
            <Button
              variant={selectedTab === "unassigned" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTab("unassigned")}
              className="whitespace-nowrap"
              data-testid="tab-unassigned"
            >
              Unassigned
            </Button>
          )}
          
          {peopleWithColors.map((person) => {
            const personTotal = personTotals.get(person.id);
            if (!personTotal) return null;
            
            return (
              <Button
                key={person.id}
                variant={selectedTab === person.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTab(person.id)}
                className="whitespace-nowrap flex items-center gap-2"
                style={{
                  backgroundColor: selectedTab === person.id ? person.color : undefined,
                  borderColor: person.color,
                  color: selectedTab === person.id ? 'white' : undefined
                }}
                data-testid={`tab-person-${person.id}`}
              >
                <div
                  className="w-5 h-5 rounded-full text-white text-xs font-semibold flex items-center justify-center"
                  style={{ backgroundColor: person.color }}
                >
                  {getInitialsForPerson(person.id)}
                </div>
                <span>{person.name}</span>
                <span className="font-semibold">${personTotal.total.toFixed(2)}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 pb-32">
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <h2 className="font-semibold text-base">
              {selectedTab === "all" 
                ? "All Items" 
                : selectedTab === "unassigned"
                ? "Unassigned Items"
                : `${getPersonById(selectedTab)?.name}'s Items`}
            </h2>
          </CardHeader>
          <CardContent className="divide-y">
            {filteredItems.map((item) => {
              const assignedPeople = (item.assignedTo as string[]) || [];
              const isPersonTab = selectedTab !== "all" && selectedTab !== "unassigned";
              
              let displayQuantity: string | undefined;
              let displayPrice = parseFloat(item.price) || 0;
              
              if (isPersonTab && assignedPeople.length > 0) {
                const adjustedQty = getAdjustedQuantity(item, selectedTab);
                displayQuantity = formatQuantity(adjustedQty);
                displayPrice = displayPrice / assignedPeople.length;
              }
              
              return (
                <ReceiptItemRow
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  quantity={item.quantity || 1}
                  price={displayPrice}
                  assignedInitials={assignedPeople.map(getInitialsForPerson)}
                  assignedColors={assignedPeople.map(getColorForPerson)}
                  onAssign={() => handleAssignClick(item.id)}
                  onEdit={() => handleEditClick(item.id)}
                  displayQuantity={displayQuantity}
                />
              );
            })}
          </CardContent>
        </Card>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span data-testid="text-receipt-subtotal">${displayTotals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span data-testid="text-receipt-tax">${displayTotals.tax.toFixed(2)}</span>
          </div>
          <button
            className="flex justify-between items-center text-sm w-full hover-elevate active-elevate-2 rounded-md -mx-2 px-2 py-1"
            onClick={() => setTipBottomSheetOpen(true)}
            data-testid="button-edit-tip"
          >
            <span className="text-muted-foreground">Tip ({tipPercentage.toFixed(0)}%)</span>
            <div className="flex items-center gap-2">
              <span data-testid="text-receipt-tip">${displayTotals.tip.toFixed(2)}</span>
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </div>
          </button>
          <div className="flex justify-between text-xl font-bold pt-2 border-t">
            <span>Total</span>
            <span data-testid="text-receipt-total">${displayTotals.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <BottomSheet
        open={assignBottomSheetOpen}
        onClose={() => {
          setAssignBottomSheetOpen(false);
          setSelectedPeople([]);
          setShowAddPersonForm(false);
          setNewPersonName("");
          setNewPersonPhone("");
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

          {!showAddPersonForm ? (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowAddPersonForm(true)}
              data-testid="button-show-add-person-form"
            >
              + Add New Person
            </Button>
          ) : (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              {'contacts' in navigator && 'ContactsManager' in window && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSelectFromContacts}
                  data-testid="button-select-from-contacts"
                >
                  Select from Contacts
                </Button>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="new-person-name">Name *</Label>
                <Input
                  id="new-person-name"
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="e.g. John Doe"
                  data-testid="input-new-person-name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newPersonName.trim()) {
                      handleAddNewPerson();
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-person-phone">Phone Number (Optional)</Label>
                <Input
                  id="new-person-phone"
                  type="tel"
                  value={newPersonPhone}
                  onChange={(e) => setNewPersonPhone(e.target.value)}
                  placeholder="e.g. (555) 123-4567"
                  data-testid="input-new-person-phone"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setShowAddPersonForm(false);
                    setNewPersonName("");
                    setNewPersonPhone("");
                  }}
                  data-testid="button-cancel-add-person"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleAddNewPerson}
                  disabled={!newPersonName.trim() || createPersonMutation.isPending}
                  data-testid="button-add-person"
                >
                  {createPersonMutation.isPending ? "Adding..." : "Add Person"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        open={editBottomSheetOpen}
        onClose={() => {
          setEditBottomSheetOpen(false);
          setEditItemData({ name: "", quantity: 1, price: "" });
        }}
        title="Edit Item"
        footer={
          <Button 
            className="w-full" 
            onClick={handleSaveEdit}
            disabled={!editItemData.name || !editItemData.price}
            data-testid="button-save-item-edit"
          >
            Save Changes
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">Item Name</Label>
            <Input
              id="item-name"
              type="text"
              value={editItemData.name}
              onChange={(e) => setEditItemData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Caesar Salad"
              data-testid="input-edit-item-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-quantity">Quantity</Label>
            <Input
              id="item-quantity"
              type="number"
              min="1"
              value={editItemData.quantity}
              onChange={(e) => setEditItemData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
              data-testid="input-edit-item-quantity"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-price">Price</Label>
            <Input
              id="item-price"
              type="text"
              inputMode="decimal"
              value={editItemData.price}
              onChange={(e) => setEditItemData(prev => ({ ...prev, price: e.target.value }))}
              placeholder="0.00"
              data-testid="input-edit-item-price"
            />
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={shareBottomSheetOpen}
        onClose={() => {
          setShareBottomSheetOpen(false);
        }}
        title="Share Receipt"
      >
        <div className="space-y-4">
          {generateShareTokenMutation.isPending ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Generating share link...</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Scan QR Code</h3>
                <p className="text-sm text-muted-foreground">
                  Anyone at the table can scan this code to see the receipt and their total
                </p>
                {qrCodeDataUrl && (
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <img src={qrCodeDataUrl} alt="QR Code" className="w-64 h-64" data-testid="img-qr-code" />
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm mb-3">Send via Text</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Select people with phone numbers to send them the link
                </p>
                <div className="space-y-2">
                  {peopleWithColors
                    .filter(person => person.phone)
                    .map((person) => (
                      <Button
                        key={person.id}
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() => handleSendSMS(person.id)}
                        data-testid={`button-send-sms-${person.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full text-white text-xs font-semibold flex items-center justify-center"
                            style={{ backgroundColor: person.color }}
                          >
                            {person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <span>{person.name}</span>
                        </div>
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    ))}
                  {peopleWithColors.filter(person => person.phone).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No people with phone numbers yet. Add phone numbers when creating people to send them text messages.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        open={tipBottomSheetOpen}
        onClose={() => setTipBottomSheetOpen(false)}
        title="Edit Tip"
      >
        <TipCalculator
          subtotal={subtotal}
          tipPercentage={tipPercentage}
          tipAmount={tipAmount}
          onTipPercentageChange={setTipPercentage}
          onTipAmountChange={handleTipChange}
        />
      </BottomSheet>
    </div>
  );
}
