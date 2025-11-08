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
  const [editBottomSheetOpen, setEditBottomSheetOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [editItemData, setEditItemData] = useState({ name: "", quantity: 1, price: "" });
  const [showAddPersonForm, setShowAddPersonForm] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
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
    mutationFn: async (name: string) => {
      return await apiRequest("/api/people", "POST", { name });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setSelectedPeople(prev => [...prev, data.id]);
      setNewPersonName("");
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
      createPersonMutation.mutate(newPersonName.trim());
    }
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
                price={parseFloat(item.price) || 0}
                assignedInitials={(item.assignedTo as string[] || []).map(getInitialsForPerson)}
                assignedColors={(item.assignedTo as string[] || []).map(getColorForPerson)}
                onAssign={() => handleAssignClick(item.id)}
                onEdit={() => handleEditClick(item.id)}
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
          setShowAddPersonForm(false);
          setNewPersonName("");
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
              <div className="space-y-2">
                <Label htmlFor="new-person-name">Person Name</Label>
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setShowAddPersonForm(false);
                    setNewPersonName("");
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
    </div>
  );
}
