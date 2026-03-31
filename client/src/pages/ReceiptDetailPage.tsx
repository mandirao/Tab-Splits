import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ReceiptItemRow from "@/components/ReceiptItemRow";
import TipCalculator from "@/components/TipCalculator";
import BottomSheet from "@/components/BottomSheet";
import PersonChip from "@/components/PersonChip";
import { ArrowLeft, Users, Share2, QrCode, MessageSquare, Pencil, Trash2, DollarSign, Plus, AlertTriangle, X, Image as ImageIcon, Copy, Check, PieChart } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Receipt, ReceiptItem, Person, Payment } from "@shared/schema";

interface Settlement {
  from: Person;
  to: Person;
  amount: string;
}
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

interface AssignmentSheetBodyProps {
  selectedItemId: string | null;
  items: any[];
  peopleWithColors: any[];
  selectedPeople: string[];
  assignedQuantities: Record<string, number>;
  setAssignedQuantities: (q: Record<string, number>) => void;
  setSelectedPeople: (p: string[]) => void;
  togglePersonSelection: (id: string) => void;
  showAddPersonForm: boolean;
  setShowAddPersonForm: (v: boolean) => void;
  newPersonName: string;
  setNewPersonName: (v: string) => void;
  newPersonPhone: string;
  setNewPersonPhone: (v: string) => void;
  handleSelectFromContacts: () => void;
  handleAddNewPerson: () => void;
  createPersonMutation: any;
}

function AssignmentSheetBody({
  selectedItemId,
  items,
  peopleWithColors,
  selectedPeople,
  assignedQuantities,
  setAssignedQuantities,
  setSelectedPeople,
  togglePersonSelection,
  showAddPersonForm,
  setShowAddPersonForm,
  newPersonName,
  setNewPersonName,
  newPersonPhone,
  setNewPersonPhone,
  handleSelectFromContacts,
  handleAddNewPerson,
  createPersonMutation,
}: AssignmentSheetBodyProps) {
  const selectedItem = items.find((i: any) => i.id === selectedItemId);
  const itemQty = selectedItem?.quantity ?? 1;
  const isMultiQty = itemQty > 1;
  const totalAssigned = selectedPeople.reduce((sum, pid) => sum + (assignedQuantities[pid] ?? 0), 0);

  const updateQty = (personId: string, newQty: number) => {
    const clamped = Math.max(0, Math.min(newQty, itemQty));
    const newQtys = { ...assignedQuantities, [personId]: clamped };
    setAssignedQuantities(newQtys);
    setSelectedPeople(
      Object.entries(newQtys).filter(([, q]) => q > 0).map(([pid]) => pid)
    );
  };

  return (
    <div className="space-y-4">
      {isMultiQty ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">How many did each person have?</p>
            <span className={`text-sm font-medium ${totalAssigned === itemQty ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
              {totalAssigned}/{itemQty} assigned
            </span>
          </div>
          <div className="space-y-1">
            {peopleWithColors.map((person: any) => {
              const qty = assignedQuantities[person.id] ?? 0;
              return (
                <div key={person.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: person.color }}
                    >
                      {person.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <span className="text-sm font-medium">{person.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => updateQty(person.id, qty - 1)}
                      disabled={qty <= 0}
                      data-testid={`button-qty-minus-${person.id}`}
                    >
                      <span className="text-base leading-none select-none">−</span>
                    </Button>
                    <span className="w-5 text-center text-sm font-semibold" data-testid={`text-qty-${person.id}`}>{qty}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => updateQty(person.id, qty + 1)}
                      disabled={totalAssigned >= itemQty}
                      data-testid={`button-qty-plus-${person.id}`}
                    >
                      <span className="text-base leading-none select-none">+</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Select one or more people to assign this item to
          </p>
          <div className="flex flex-wrap gap-2">
            {peopleWithColors.map((person: any) => (
              <PersonChip
                key={person.id}
                name={person.name}
                initials={person.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                color={person.color}
                selected={selectedPeople.includes(person.id)}
                onSelect={() => togglePersonSelection(person.id)}
              />
            ))}
          </div>
        </>
      )}

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
              onKeyDown={(e) => { if (e.key === 'Enter' && newPersonName.trim()) handleAddNewPerson(); }}
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
              onClick={() => { setShowAddPersonForm(false); setNewPersonName(""); setNewPersonPhone(""); }}
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
  );
}

export default function ReceiptDetailPage({ params }: { params: { id: string } }) {
  const receiptId = params?.id || window.location.pathname.split('/')[2];
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [assignBottomSheetOpen, setAssignBottomSheetOpen] = useState(false);
  const [editBottomSheetOpen, setEditBottomSheetOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [assignedQuantities, setAssignedQuantities] = useState<Record<string, number>>({});
  const [editItemData, setEditItemData] = useState({ name: "", quantity: 1, price: "" });
  const [showAddPersonForm, setShowAddPersonForm] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonPhone, setNewPersonPhone] = useState("");
  const [shareBottomSheetOpen, setShareBottomSheetOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [urlCopied, setUrlCopied] = useState(false);
  const [activeShareToken, setActiveShareToken] = useState<string | null>(null);
  const [tipPercentage, setTipPercentage] = useState(20);
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [tipBottomSheetOpen, setTipBottomSheetOpen] = useState(false);
  const [managePeopleBottomSheetOpen, setManagePeopleBottomSheetOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<string | null>(null);
  const [paymentsBottomSheetOpen, setPaymentsBottomSheetOpen] = useState(false);
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(false);
  const [selectedPayerPersonId, setSelectedPayerPersonId] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [payerVenmoInput, setPayerVenmoInput] = useState<string>("");
  const [validationWarning, setValidationWarning] = useState<{
    scannedImage: string;
    itemCount: number;
    subtotalDiff: string;
    totalDiff: string;
  } | null>(null);
  const [showScannedImage, setShowScannedImage] = useState(false);
  const [scannedImageUrl, setScannedImageUrl] = useState<string | null>(null);
  const [addItemBottomSheetOpen, setAddItemBottomSheetOpen] = useState(false);
  const [newItemData, setNewItemData] = useState({ name: "", quantity: 1, price: "" });
  const [paidByBottomSheetOpen, setPaidByBottomSheetOpen] = useState(false);
  const [venmoInput, setVenmoInput] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    // Check if a scanned image exists for this receipt
    const imageUrl = sessionStorage.getItem(`scanned_image_${receiptId}`);
    if (imageUrl) {
      setScannedImageUrl(imageUrl);
    } else {
      setScannedImageUrl(null);
    }
    
    // Check for validation warning
    const warningData = sessionStorage.getItem(`receipt-${receiptId}-warning`);
    if (warningData) {
      const parsed = JSON.parse(warningData);
      setValidationWarning(parsed);
      // Also set the scanned image if not already set
      if (!imageUrl && parsed.scannedImage) {
        setScannedImageUrl(parsed.scannedImage);
      }
    } else {
      setValidationWarning(null);
    }
  }, [receiptId]);

  const dismissWarning = () => {
    sessionStorage.removeItem(`receipt-${receiptId}-warning`);
    setValidationWarning(null);
  };

  const { data: receipt } = useQuery<Receipt>({
    queryKey: ["/api/receipts", receiptId],
  });

  const { data: items = [] } = useQuery<ReceiptItem[]>({
    queryKey: ["/api/receipts", receiptId, "items"],
  });

  // Fetch people on this specific receipt
  const { data: receiptPeople = [] } = useQuery<Person[]>({
    queryKey: ["/api/receipts", receiptId, "people"],
  });

  // Fetch all people for assignment dropdown (global list)
  const { data: allPeople = [] } = useQuery<Person[]>({
    queryKey: ["/api/people"],
  });

  // Fetch payments for this receipt
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/receipts", receiptId, "payments"],
  });

  // Fetch settlement calculation
  const { data: settlement = [] } = useQuery<Settlement[]>({
    queryKey: ["/api/receipts", receiptId, "settlement"],
  });

  // People on this receipt with colors (for assignment UI, manage people sheet, and counter)
  const peopleWithColors: PersonWithColor[] = useMemo(() => {
    return receiptPeople.map((person, idx) => ({
      ...person,
      color: PERSON_COLORS[idx % PERSON_COLORS.length]
    }));
  }, [receiptPeople]);

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

  const updatePaidByMutation = useMutation({
    mutationFn: async (data: { paidById: string | null }) => {
      return await apiRequest(`/api/receipts/${receiptId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
      toast({ title: "Payer updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update payer", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const updateReceiptNameMutation = useMutation({
    mutationFn: async (data: { restaurantName: string }) => {
      return await apiRequest(`/api/receipts/${receiptId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
      setEditingName(false);
      toast({ title: "Name updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update name", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const updatePersonVenmoMutation = useMutation({
    mutationFn: async ({ personId, venmoUsername }: { personId: string; venmoUsername: string }) => {
      return await apiRequest(`/api/people/${personId}`, "PATCH", { venmoUsername });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      toast({ title: "Venmo username saved" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to save Venmo username", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, assignedTo, assignedQuantities }: { itemId: string; assignedTo: string[]; assignedQuantities: Record<string, number> }) => {
      return await apiRequest(`/api/items/${itemId}`, "PATCH", { assignedTo, assignedQuantities });
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
      // Create the person
      const person = await apiRequest("/api/people", "POST", data);
      // Add them to this receipt
      await apiRequest(`/api/receipts/${receiptId}/people`, "POST", { personId: person.id });
      return person;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "people"] });
      setSelectedPeople(prev => [...prev, data.id]);
      setNewPersonName("");
      setNewPersonPhone("");
      setShowAddPersonForm(false);
      toast({ title: "Person added to receipt" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add person", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const deletePersonMutation = useMutation({
    mutationFn: async (personId: string) => {
      return await apiRequest(`/api/receipts/${receiptId}/people/${personId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
      setPersonToDelete(null);
      toast({ title: "Person removed from receipt" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Cannot remove person", 
        description: error.message || "This person has items assigned to them. Unassign their items first.",
        variant: "destructive" 
      });
      setPersonToDelete(null);
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

  const createPaymentMutation = useMutation({
    mutationFn: async (data: { personId: string; amount: string }) => {
      return await apiRequest(`/api/receipts/${receiptId}/payments`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "settlement"] });
      setShowAddPaymentForm(false);
      setSelectedPayerPersonId("");
      setPaymentAmount("");
      toast({ title: "Payment added" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add payment", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      return await apiRequest(`/api/payments/${paymentId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "settlement"] });
      toast({ title: "Payment deleted" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete payment", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: { name: string; quantity: number; price: string }) => {
      return await apiRequest(`/api/receipts/${receiptId}/items`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
      setAddItemBottomSheetOpen(false);
      setNewItemData({ name: "", quantity: 1, price: "" });
      toast({ title: "Item added" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add item", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await apiRequest(`/api/items/${itemId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
      toast({ title: "Item deleted" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete item", 
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
    const existingPeople = (item?.assignedTo as string[]) || [];
    const existingQtys = (item?.assignedQuantities as Record<string, number>) || {};
    setSelectedPeople(existingPeople);
    setAssignedQuantities(existingQtys);
    setAssignBottomSheetOpen(true);
  };

  const handleSaveAssignment = () => {
    if (selectedItemId) {
      updateItemMutation.mutate({
        itemId: selectedItemId,
        assignedTo: selectedPeople,
        assignedQuantities
      });
    }
    setAssignBottomSheetOpen(false);
    setSelectedItemId(null);
    setSelectedPeople([]);
    setAssignedQuantities({});
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
    const supportsContacts = 'contacts' in navigator && 'ContactsManager' in window;
    
    if (!supportsContacts) {
      toast({
        title: "Contacts not supported",
        description: "Your browser doesn't support the contacts feature. Please enter the name manually.",
        variant: "destructive"
      });
      return;
    }
    
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
    } catch (error: any) {
      console.error('Error selecting contact:', error);
      
      if (error?.name === 'InvalidStateError') {
        toast({
          title: "Please try again",
          description: "Tap the button again to select a contact",
          variant: "destructive"
        });
      } else if (error?.name === 'SecurityError') {
        toast({
          title: "Contacts access denied",
          description: "Please allow contacts access in your browser settings",
          variant: "destructive"
        });
      } else if (error?.name === 'TypeError') {
        toast({
          title: "Contacts not available",
          description: "This feature requires a secure connection (HTTPS)",
          variant: "destructive"
        });
      } else {
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

  const handleManagePeopleClick = () => {
    setManagePeopleBottomSheetOpen(true);
  };

  const handleDeletePerson = (personId: string) => {
    const hasAssignedItems = items.some(item => 
      (item.assignedTo as string[] || []).includes(personId)
    );
    
    if (hasAssignedItems) {
      toast({
        title: "Cannot remove person",
        description: "This person has items assigned to them. Unassign their items first.",
        variant: "destructive"
      });
      return;
    }
    
    setPersonToDelete(personId);
  };

  const confirmDeletePerson = () => {
    if (personToDelete) {
      deletePersonMutation.mutate(personToDelete);
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

  const handlePaymentsClick = () => {
    setPaymentsBottomSheetOpen(true);
  };

  const handleAddPayment = () => {
    if (!selectedPayerPersonId || !paymentAmount) {
      toast({
        title: "Missing information",
        description: "Please select a person and enter an amount",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid positive amount",
        variant: "destructive"
      });
      return;
    }

    // If Venmo username was provided, update the person's Venmo
    if (payerVenmoInput.trim()) {
      updatePersonVenmoMutation.mutate({
        personId: selectedPayerPersonId,
        venmoUsername: payerVenmoInput.trim()
      });
    }
    
    createPaymentMutation.mutate({
      personId: selectedPayerPersonId,
      amount: amount.toFixed(2)
    });
  };

  const handleDeletePayment = (paymentId: string) => {
    deletePaymentMutation.mutate(paymentId);
  };

  const handleAddItem = () => {
    if (!newItemData.name.trim() || !newItemData.price) {
      toast({
        title: "Missing information",
        description: "Please enter item name and price",
        variant: "destructive"
      });
      return;
    }

    const price = parseFloat(newItemData.price);
    if (isNaN(price) || price < 0) {
      toast({
        title: "Invalid price",
        description: "Please enter a valid price",
        variant: "destructive"
      });
      return;
    }

    createItemMutation.mutate({
      name: newItemData.name.trim(),
      quantity: newItemData.quantity,
      price: price.toFixed(2)
    });
  };

  const handleDeleteItem = (itemId: string) => {
    deleteItemMutation.mutate(itemId);
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
    const qtys = (item.assignedQuantities as Record<string, number>) || {};
    
    if (assignedPeople.length > 0) {
      // Use assignedQuantities for proportional split if present, else equal split
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
    const proportion = subtotal > 0 ? totals.subtotal / subtotal : 0;
    totals.tax = tax * proportion;
    totals.tip = tipAmount * proportion;
    totals.total = totals.subtotal + totals.tax + totals.tip;
  });

  // Check if there are unassigned items
  const hasUnassignedItems = items.some(item => (item.assignedTo as string[] || []).length === 0);

  // Calculate running total of all items
  const itemsSubtotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.price) || 0);
  }, 0);
  
  // Check if items match receipt subtotal
  const subtotalDifference = Math.abs(itemsSubtotal - subtotal);
  const totalsMatch = subtotalDifference < 0.01;

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
    const qtys = (item.assignedQuantities as Record<string, number>) || {};
    const originalQuantity = item.quantity || 1;
    
    if (assignedPeople.length === 0) {
      return originalQuantity;
    }
    
    // If this item has per-person quantities, return the person's specific quantity
    if (qtys[personId] !== undefined) {
      return qtys[personId];
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
  const displayTotals = isPersonTab
    ? (personTotals.get(selectedTab) || { subtotal: 0, tax: 0, tip: 0, total: 0 })
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
          <button 
            className="text-xl font-bold flex-1 text-center flex items-center justify-center gap-1 hover:text-primary transition-colors"
            onClick={() => {
              setNameInput(receipt.restaurantName || "");
              setEditingName(true);
            }}
            data-testid="button-edit-name"
          >
            <span>{receipt.restaurantName || "Receipt"}</span>
            <Pencil className="h-3.5 w-3.5 opacity-50" />
          </button>
          <div className="flex gap-2">
            {scannedImageUrl && (
              <Button 
                size="icon" 
                variant="ghost"
                onClick={() => setShowScannedImage(true)}
                data-testid="button-view-receipt-image"
              >
                <ImageIcon className="h-5 w-5" />
              </Button>
            )}
            <Button 
              size="icon" 
              variant="ghost"
              onClick={() => setLocation(`/receipt/${receiptId}/view`)}
              data-testid="button-view-summary"
            >
              <PieChart className="h-5 w-5" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost"
              onClick={handlePaymentsClick}
              data-testid="button-open-payments"
            >
              <DollarSign className="h-5 w-5" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost"
              onClick={handleShareClick}
              data-testid="button-share-receipt"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Validation Warning Banner */}
      {validationWarning && (
        <div className="bg-destructive/10 border-b border-destructive/20 p-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-destructive">Possible Missing Items</div>
              <p className="text-xs text-muted-foreground mt-1">
                Scanned {validationWarning.itemCount} items, but totals don't match (diff: ${Math.max(parseFloat(validationWarning.subtotalDiff), parseFloat(validationWarning.totalDiff)).toFixed(2)}). Please verify all items were captured.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowScannedImage(true)}
                className="h-7 px-2"
                data-testid="button-view-scanned-image"
              >
                <ImageIcon className="h-3 w-3 mr-1" />
                View Image
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={dismissWarning}
                className="h-7 px-2"
                data-testid="button-dismiss-warning"
              >
                Confirmed
              </Button>
            </div>
          </div>
        </div>
      )}

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

          {/* Add Person tab button — always at far right */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManagePeopleClick}
            className="whitespace-nowrap flex items-center gap-1.5 text-muted-foreground"
            data-testid="button-add-person-tab"
          >
            <Users className="h-3.5 w-3.5" />
            Add Person
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 pb-32">
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="font-semibold text-base truncate">
                  {selectedTab === "all" 
                    ? "All Items" 
                    : selectedTab === "unassigned"
                    ? "Unassigned Items"
                    : `${getPersonById(selectedTab)?.name}'s Items`}
                </h2>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {filteredItems.length}
                  {selectedTab === "all" && hasUnassignedItems && (
                    <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-medium">
                      · {items.filter(i => (i.assignedTo as string[] || []).length === 0).length} unassigned
                    </span>
                  )}
                </span>
              </div>
              {selectedTab === "all" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddItemBottomSheetOpen(true)}
                  className="flex-shrink-0 flex items-center gap-1"
                  data-testid="button-add-item"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </Button>
              )}
            </div>
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
                const qtys = (item.assignedQuantities as Record<string, number>) || {};
                const totalAssignedQty = assignedPeople.reduce((sum, pid) => sum + (qtys[pid] ?? 1), 0);
                const personQty = qtys[selectedTab] ?? 1;
                displayPrice = totalAssignedQty > 0
                  ? (personQty / totalAssignedQty) * displayPrice
                  : displayPrice / assignedPeople.length;
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
                  onDelete={() => handleDeleteItem(item.id)}
                  displayQuantity={displayQuantity}
                />
              );
            })}
          </CardContent>
        </Card>

        {/* Paid By Section — inside scrollable main so it clears the fixed totals bar */}
        <div className="bg-card rounded-lg p-4 shadow-sm border mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Paid by</p>
                {receipt?.paidById ? (
                  <p className="font-medium" data-testid="text-paid-by-name">
                    {peopleWithColors.find(p => p.id === receipt.paidById)?.name || "Unknown"}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Not set</p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPaidByBottomSheetOpen(true);
                const payer = peopleWithColors.find(p => p.id === receipt?.paidById);
                setVenmoInput(payer?.venmoUsername || "");
              }}
              data-testid="button-edit-paid-by"
            >
              {receipt?.paidById ? "Change" : "Set Payer"}
            </Button>
          </div>
          {receipt?.paidById && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Venmo Username</p>
                  <p className="font-medium" data-testid="text-venmo-username">
                    {peopleWithColors.find(p => p.id === receipt.paidById)?.venmoUsername || "Not set"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4">
        <div className="space-y-3">
          {/* Running total comparison - only show on "all" tab */}
          {selectedTab === "all" && (
            <div className={`flex justify-between text-sm p-2 rounded-md ${totalsMatch ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
              <span className="text-muted-foreground">Items Total</span>
              <div className="flex items-center gap-2">
                <span data-testid="text-items-subtotal">${itemsSubtotal.toFixed(2)}</span>
                {totalsMatch ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    ({itemsSubtotal > subtotal ? '+' : ''}${(itemsSubtotal - subtotal).toFixed(2)})
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span data-testid="text-receipt-subtotal">${displayTotals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span data-testid="text-receipt-tax">${displayTotals.tax.toFixed(2)}</span>
          </div>
          {selectedTab === "all" ? (
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
          ) : (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tip ({tipPercentage.toFixed(0)}%)</span>
              <span data-testid="text-receipt-tip">${displayTotals.tip.toFixed(2)}</span>
            </div>
          )}
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
          setAssignedQuantities({});
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
        <AssignmentSheetBody
          selectedItemId={selectedItemId}
          items={items}
          peopleWithColors={peopleWithColors}
          selectedPeople={selectedPeople}
          assignedQuantities={assignedQuantities}
          setAssignedQuantities={setAssignedQuantities}
          setSelectedPeople={setSelectedPeople}
          togglePersonSelection={togglePersonSelection}
          showAddPersonForm={showAddPersonForm}
          setShowAddPersonForm={setShowAddPersonForm}
          newPersonName={newPersonName}
          setNewPersonName={setNewPersonName}
          newPersonPhone={newPersonPhone}
          setNewPersonPhone={setNewPersonPhone}
          handleSelectFromContacts={handleSelectFromContacts}
          handleAddNewPerson={handleAddNewPerson}
          createPersonMutation={createPersonMutation}
        />
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
                <h3 className="font-semibold text-sm mb-3">Copy Link</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Quick copy the link to share anywhere
                </p>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={async () => {
                    const shareUrl = `${window.location.origin}/share/${activeShareToken}`;
                    await navigator.clipboard.writeText(shareUrl);
                    setUrlCopied(true);
                    toast({ title: "Link copied to clipboard!" });
                    setTimeout(() => setUrlCopied(false), 2000);
                  }}
                  data-testid="button-copy-url"
                >
                  <span className="truncate mr-2 text-muted-foreground">
                    {`${window.location.origin}/share/${activeShareToken}`}
                  </span>
                  {urlCopied ? (
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Copy className="h-4 w-4 flex-shrink-0" />
                  )}
                </Button>
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
          onSave={() => setTipBottomSheetOpen(false)}
        />
      </BottomSheet>

      <BottomSheet
        open={managePeopleBottomSheetOpen}
        onClose={() => {
          setManagePeopleBottomSheetOpen(false);
          setShowAddPersonForm(false);
          setNewPersonName("");
          setNewPersonPhone("");
        }}
        title="Manage People"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add or remove people from this receipt
          </p>

          {peopleWithColors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">People on this receipt</h3>
              {peopleWithColors.map((person) => {
                const hasAssignedItems = items.some(item => 
                  (item.assignedTo as string[] || []).includes(person.id)
                );
                
                return (
                  <div
                    key={person.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`person-item-${person.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full text-white text-sm font-semibold flex items-center justify-center"
                        style={{ backgroundColor: person.color }}
                      >
                        {person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{person.name}</p>
                        {person.phone && (
                          <p className="text-xs text-muted-foreground">{person.phone}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeletePerson(person.id)}
                      disabled={hasAssignedItems}
                      data-testid={`button-delete-person-${person.id}`}
                      className={hasAssignedItems ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {!showAddPersonForm ? (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowAddPersonForm(true)}
              data-testid="button-show-add-person-form-manage"
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
                  data-testid="button-select-from-contacts-manage"
                >
                  Select from Contacts
                </Button>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="manage-person-name">Name *</Label>
                <Input
                  id="manage-person-name"
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="e.g. John Doe"
                  data-testid="input-manage-person-name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newPersonName.trim()) {
                      handleAddNewPerson();
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manage-person-phone">Phone Number (Optional)</Label>
                <Input
                  id="manage-person-phone"
                  type="tel"
                  value={newPersonPhone}
                  onChange={(e) => setNewPersonPhone(e.target.value)}
                  placeholder="e.g. (555) 123-4567"
                  data-testid="input-manage-person-phone"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowAddPersonForm(false);
                    setNewPersonName("");
                    setNewPersonPhone("");
                  }}
                  data-testid="button-cancel-add-person-manage"
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAddNewPerson}
                  disabled={!newPersonName.trim()}
                  data-testid="button-add-person-manage"
                >
                  Add Person
                </Button>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        open={paymentsBottomSheetOpen}
        onClose={() => {
          setPaymentsBottomSheetOpen(false);
          setShowAddPaymentForm(false);
          setSelectedPayerPersonId("");
          setPaymentAmount("");
          setPayerVenmoInput("");
        }}
        title="Payments"
      >
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Payments Made</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No payments recorded yet
              </p>
            ) : (
              <div className="space-y-2">
                {payments.map((payment) => {
                  const payer = getPersonById(payment.personId);
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                      data-testid={`payment-${payment.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {payer && (
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                            style={{ backgroundColor: payer.color }}
                          >
                            {getInitialsForPerson(payer.id)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{payer?.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">Paid ${parseFloat(payment.amount).toFixed(2)}</p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeletePayment(payment.id)}
                        data-testid={`button-delete-payment-${payment.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {!showAddPaymentForm ? (
              <Button
                variant="outline"
                className="w-full mt-3"
                onClick={() => {
                  setShowAddPaymentForm(true);
                  setPaymentAmount(total.toFixed(2));
                  setPayerVenmoInput("");
                }}
                data-testid="button-show-add-payment-form"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </Button>
            ) : (
              <div className="mt-3 p-4 border rounded-lg bg-muted/30 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="payer-select">Who paid?</Label>
                  <select
                    id="payer-select"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={selectedPayerPersonId}
                    onChange={(e) => {
                      const personId = e.target.value;
                      setSelectedPayerPersonId(personId);
                      const person = peopleWithColors.find(p => p.id === personId);
                      setPayerVenmoInput(person?.venmoUsername || "");
                    }}
                    data-testid="select-payer"
                  >
                    <option value="">Select a person</option>
                    {peopleWithColors.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-amount">Amount paid</Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    data-testid="input-payment-amount"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payer-venmo">Venmo username (optional)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                    <Input
                      id="payer-venmo"
                      type="text"
                      placeholder="username"
                      className="pl-7"
                      value={payerVenmoInput}
                      onChange={(e) => setPayerVenmoInput(e.target.value.replace(/^@/, ''))}
                      data-testid="input-payer-venmo"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowAddPaymentForm(false);
                      setSelectedPayerPersonId("");
                      setPaymentAmount("");
                      setPayerVenmoInput("");
                    }}
                    data-testid="button-cancel-add-payment"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleAddPayment}
                    disabled={!selectedPayerPersonId || !paymentAmount}
                    data-testid="button-add-payment"
                  >
                    Add Payment
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </BottomSheet>

      <AlertDialog open={personToDelete !== null} onOpenChange={(open) => !open && setPersonToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove person from receipt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {personToDelete && getPersonById(personToDelete)?.name} from this receipt. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-person">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeletePerson}
              data-testid="button-confirm-delete-person"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editingName} onOpenChange={(open) => !open && setEditingName(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tab Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tab-name">Restaurant / Tab Name</Label>
              <Input
                id="tab-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g., Joe's Pizza"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nameInput.trim()) {
                    updateReceiptNameMutation.mutate({ restaurantName: nameInput.trim() });
                  }
                }}
                data-testid="input-tab-name"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditingName(false)}
                data-testid="button-cancel-edit-name"
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => updateReceiptNameMutation.mutate({ restaurantName: nameInput.trim() })}
                disabled={!nameInput.trim() || updateReceiptNameMutation.isPending}
                data-testid="button-save-name"
              >
                {updateReceiptNameMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomSheet
        open={addItemBottomSheetOpen}
        onClose={() => {
          setAddItemBottomSheetOpen(false);
          setNewItemData({ name: "", quantity: 1, price: "" });
        }}
        title="Add Item"
        footer={
          <Button 
            className="w-full" 
            onClick={handleAddItem}
            disabled={!newItemData.name.trim() || !newItemData.price || createItemMutation.isPending}
            data-testid="button-save-new-item"
          >
            {createItemMutation.isPending ? "Adding..." : "Add Item"}
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add a missing item to the receipt
          </p>
          <div className="space-y-2">
            <Label htmlFor="new-item-name">Item Name</Label>
            <Input
              id="new-item-name"
              type="text"
              value={newItemData.name}
              onChange={(e) => setNewItemData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Caesar Salad"
              data-testid="input-new-item-name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const priceInput = document.getElementById('new-item-price');
                  priceInput?.focus();
                }
              }}
            />
          </div>
          <div className="flex gap-3">
            <div className="space-y-2 flex-1">
              <Label htmlFor="new-item-quantity">Qty</Label>
              <Input
                id="new-item-quantity"
                type="number"
                min="1"
                value={newItemData.quantity}
                onChange={(e) => setNewItemData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                data-testid="input-new-item-quantity"
              />
            </div>
            <div className="space-y-2 flex-[2]">
              <Label htmlFor="new-item-price">Price ($)</Label>
              <Input
                id="new-item-price"
                type="text"
                inputMode="decimal"
                value={newItemData.price}
                onChange={(e) => setNewItemData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="0.00"
                data-testid="input-new-item-price"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newItemData.name.trim() && newItemData.price) {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
              />
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* Paid By Bottom Sheet */}
      <BottomSheet
        open={paidByBottomSheetOpen}
        onClose={() => {
          setPaidByBottomSheetOpen(false);
          setVenmoInput("");
        }}
        title="Who Paid the Bill?"
        footer={
          <div className="flex gap-2">
            {receipt?.paidById && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  updatePaidByMutation.mutate({ paidById: null });
                  setPaidByBottomSheetOpen(false);
                  setVenmoInput("");
                }}
                data-testid="button-clear-paid-by"
              >
                Clear
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={() => setPaidByBottomSheetOpen(false)}
              data-testid="button-done-paid-by"
            >
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select who covered the bill so everyone can pay them back
          </p>
          
          <div className="space-y-2">
            {peopleWithColors.map((person) => {
              const isSelected = receipt?.paidById === person.id;
              return (
                <button
                  key={person.id}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isSelected 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover-elevate'
                  }`}
                  onClick={() => {
                    updatePaidByMutation.mutate({ paidById: person.id });
                    setVenmoInput(person.venmoUsername || "");
                  }}
                  data-testid={`button-select-payer-${person.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
                      style={{ backgroundColor: person.color }}
                    >
                      {person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <span className="font-medium">{person.name}</span>
                  </div>
                  {isSelected && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {receipt?.paidById && (
            <div className="pt-4 border-t space-y-3">
              <div className="space-y-2">
                <Label htmlFor="venmo-username">Venmo Username</Label>
                <div className="flex gap-2">
                  <Input
                    id="venmo-username"
                    type="text"
                    placeholder="@username or username"
                    value={venmoInput}
                    onChange={(e) => setVenmoInput(e.target.value)}
                    data-testid="input-venmo-username"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (receipt.paidById && venmoInput.trim()) {
                        updatePersonVenmoMutation.mutate({
                          personId: receipt.paidById,
                          venmoUsername: venmoInput.trim().replace(/^@/, '')
                        });
                      }
                    }}
                    disabled={!venmoInput.trim() || updatePersonVenmoMutation.isPending}
                    data-testid="button-save-venmo"
                  >
                    {updatePersonVenmoMutation.isPending ? "..." : "Save"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Others can pay via Venmo when viewing the shared receipt
                </p>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>

      <Dialog open={showScannedImage} onOpenChange={setShowScannedImage}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Scanned Receipt Image</DialogTitle>
          </DialogHeader>
          {scannedImageUrl && (
            <div className="relative">
              <img 
                src={scannedImageUrl} 
                alt="Scanned receipt" 
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
