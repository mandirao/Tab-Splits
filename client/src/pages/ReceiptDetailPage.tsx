import { useState, useEffect, useMemo, useRef } from "react";
import { getDisplayNames } from "@/lib/personDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, Phone, BookUser } from "lucide-react";
import ReceiptItemRow from "@/components/ReceiptItemRow";
import TipCalculator from "@/components/TipCalculator";
import BottomSheet from "@/components/BottomSheet";
import PersonChip from "@/components/PersonChip";
import { ArrowLeft, Users, Share2, QrCode, MessageSquare, Pencil, Trash2, DollarSign, Plus, AlertTriangle, X, Image as ImageIcon, Copy, Check, PieChart, RefreshCw, ListChecks, Sparkles, UtensilsCrossed, GlassWater, Cake, Tag, Circle, CheckCircle2, MinusCircle } from "lucide-react";
import logoUrl from "@assets/icon-1024_1775014486817.png";
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
  'hsl(38, 92%, 50%)',   // Amber
  'hsl(17, 81%, 53%)',   // Coral
  'hsl(345, 77%, 57%)',  // Raspberry
  'hsl(258, 90%, 66%)',  // Violet
  'hsl(217, 91%, 60%)',  // Blue
  'hsl(164, 87%, 39%)',  // Teal
  'hsl(142, 71%, 45%)',  // Lime
  'hsl(330, 81%, 60%)',  // Pink
];

// ─── AddPersonPanel ─────────────────────────────────────────────────────────

type AddPersonMode = "past" | "contacts" | "new";

interface AddPersonPanelProps {
  receiptId: string;
  receiptPeopleIds: string[];
  allPeople: Person[];
  onAdded: (personId: string) => void;
  compact?: boolean;
}

function AddPersonPanel({ receiptId, receiptPeopleIds, allPeople, onAdded, compact }: AddPersonPanelProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const available = allPeople.filter(p => !receiptPeopleIds.includes(p.id));
  const [mode, setMode] = useState<AddPersonMode>(available.length > 0 ? "past" : "new");
  const [search, setSearch] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [pendingContact, setPendingContact] = useState<{ name: string; phone: string } | null>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);

  const filteredPast = available.filter(p => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.phone ?? "").includes(q);
  });

  const addExistingMutation = useMutation({
    mutationFn: async (personId: string) => {
      await apiRequest(`/api/receipts/${receiptId}/people`, "POST", { personId });
      return personId;
    },
    onSuccess: (personId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      onAdded(personId);
      setExpanded(false);
      setSearch("");
    },
    onError: (err: any) => toast({ title: "Could not add person", description: err.message, variant: "destructive" }),
  });

  const createAndAddMutation = useMutation({
    mutationFn: async (data: { name: string; phone?: string }) => {
      const person = await apiRequest("/api/people", "POST", data);
      await apiRequest(`/api/receipts/${receiptId}/people`, "POST", { personId: person.id });
      return person;
    },
    onSuccess: (person) => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "people"] });
      onAdded(person.id);
      setFirstName(""); setLastName(""); setPhone("");
      setPendingContact(null);
      setExpanded(false);
    },
    onError: (err: any) => toast({ title: "Could not add person", description: err.message, variant: "destructive" }),
  });

  const isBusy = addExistingMutation.isPending || createAndAddMutation.isPending;

  const handleOpenContacts = async () => {
    const supported = "contacts" in navigator && "ContactsManager" in window;
    if (!supported) {
      toast({ title: "Contacts not available", description: "Your browser doesn't support contact picking. Use New Person instead." });
      return;
    }
    try {
      const contacts = await (navigator as any).contacts.select(["name", "tel"], { multiple: false });
      if (contacts?.length > 0) {
        const c = contacts[0];
        setPendingContact({
          name: c.name?.[0] ?? "",
          phone: c.tel?.[0] ?? "",
        });
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast({ title: "Could not open contacts", description: "Please try again or enter manually.", variant: "destructive" });
      }
    }
  };

  const handleAddNew = () => {
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!name) return;
    createAndAddMutation.mutate({ name, ...(phone.trim() ? { phone: phone.trim() } : {}) });
  };

  if (!expanded) {
    if (compact) {
      return (
        <div
          className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border-2 border-border bg-card cursor-pointer hover-elevate text-sm font-medium"
          onClick={() => {
            setExpanded(true);
            setMode(available.length > 0 ? "past" : "new");
          }}
          data-testid="button-show-add-person-panel"
          role="button"
        >
          <UserPlus className="h-4 w-4" />
          Add Person
        </div>
      );
    }
    return (
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setExpanded(true);
          setMode(available.length > 0 ? "past" : "new");
        }}
        data-testid="button-show-add-person-panel"
      >
        <UserPlus className="h-4 w-4 mr-2" /> Add Person
      </Button>
    );
  }

  return (
    <div className={`space-y-3 border rounded-lg p-4 bg-muted/20${compact ? " w-full" : ""}`}>
      {/* Mode tabs */}
      <div className="flex gap-1 bg-muted rounded-md p-1">
        {[
          { id: "past" as const, label: "Past Diners", icon: BookUser },
          { id: "contacts" as const, label: "Contacts", icon: Phone },
          { id: "new" as const, label: "New", icon: UserPlus },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setMode(id); setSearch(""); setPendingContact(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded transition-colors ${
              mode === id
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground"
            }`}
            data-testid={`button-add-mode-${id}`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Past Diners */}
      {mode === "past" && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="pl-8 text-sm"
              data-testid="input-past-diners-search"
            />
          </div>
          {filteredPast.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              {available.length === 0 ? "No past diners in database yet." : "No matches found."}
            </p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {filteredPast.map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 px-1"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addExistingMutation.mutate(p.id)}
                    disabled={isBusy}
                    data-testid={`button-add-past-${p.id}`}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contacts */}
      {mode === "contacts" && (
        <div className="space-y-3">
          {pendingContact ? (
            <>
              <div className="flex items-center gap-3 p-3 rounded-md border bg-background">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {pendingContact.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pendingContact.name}</p>
                  {pendingContact.phone && <p className="text-xs text-muted-foreground">{pendingContact.phone}</p>}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setPendingContact(null)}
                  data-testid="button-clear-contact"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Button
                className="w-full"
                onClick={() => createAndAddMutation.mutate({
                  name: pendingContact.name,
                  ...(pendingContact.phone ? { phone: pendingContact.phone } : {}),
                })}
                disabled={!pendingContact.name || isBusy}
                data-testid="button-add-contact"
              >
                {isBusy ? "Adding…" : `Add ${pendingContact.name.split(" ")[0]}`}
              </Button>
            </>
          ) : (
            <>
              {"contacts" in navigator && "ContactsManager" in window ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleOpenContacts}
                  data-testid="button-open-contacts"
                >
                  <Phone className="h-4 w-4 mr-2" /> Open Contacts
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-3">
                  Contact picking isn't supported on this browser. Use the New tab to add someone manually.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* New Person */}
      {mode === "new" && (
        <div className="space-y-2">
          <div>
            <Label htmlFor="ap-first" className="text-xs">First name *</Label>
            <Input
              id="ap-first"
              ref={firstNameRef}
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="e.g. Alex"
              className="mt-1"
              data-testid="input-add-person-first"
              onKeyDown={e => { if (e.key === "Enter") handleAddNew(); }}
            />
          </div>
          <div>
            <Label htmlFor="ap-last" className="text-xs">Last name <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="ap-last"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="e.g. Chen"
              className="mt-1"
              data-testid="input-add-person-last"
            />
          </div>
          <div>
            <Label htmlFor="ap-phone" className="text-xs">Phone <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="ap-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. (555) 123-4567"
              className="mt-1"
              data-testid="input-add-person-phone"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleAddNew}
            disabled={!firstName.trim() || isBusy}
            data-testid="button-add-new-person"
          >
            {isBusy ? "Adding…" : "Add Person"}
          </Button>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={() => { setExpanded(false); setSearch(""); setFirstName(""); setLastName(""); setPhone(""); setPendingContact(null); }}
        data-testid="button-cancel-add-person"
      >
        Cancel
      </Button>
    </div>
  );
}

// ─── AssignmentSheetBody ─────────────────────────────────────────────────────

interface AssignmentSheetBodyProps {
  selectedItemId: string | null;
  items: any[];
  peopleWithColors: any[];
  selectedPeople: string[];
  assignedQuantities: Record<string, number>;
  setAssignedQuantities: (q: Record<string, number>) => void;
  setSelectedPeople: (p: string[]) => void;
  receiptId: string;
  receiptPeopleIds: string[];
  allPeople: Person[];
}

function AssignmentSheetBody({
  selectedItemId,
  items,
  peopleWithColors,
  selectedPeople,
  assignedQuantities,
  setAssignedQuantities,
  setSelectedPeople,
  receiptId,
  receiptPeopleIds,
  allPeople,
}: AssignmentSheetBodyProps) {
  // Detect initial split mode: if any assigned person has a saved weight, start in "share" mode
  const hasSavedShares = selectedPeople.length > 1 &&
    selectedPeople.some(pid => (assignedQuantities[pid] ?? 0) > 0);
  const [splitMode, setSplitMode] = useState<"equal" | "share">(hasSavedShares ? "share" : "equal");

  // Reset split mode when the item changes
  useEffect(() => {
    const hasSaved = selectedPeople.length > 1 &&
      selectedPeople.some(pid => (assignedQuantities[pid] ?? 0) > 0);
    setSplitMode(hasSaved ? "share" : "equal");
  }, [selectedItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTogglePerson = (personId: string) => {
    const isSelected = selectedPeople.includes(personId);
    if (isSelected) {
      const next = selectedPeople.filter(pid => pid !== personId);
      setSelectedPeople(next);
      const newQtys = { ...assignedQuantities };
      delete newQtys[personId];
      setAssignedQuantities(newQtys);
    } else {
      const next = [...selectedPeople, personId];
      setSelectedPeople(next);
      if (splitMode === "share") {
        setAssignedQuantities({ ...assignedQuantities, [personId]: 1 });
      }
    }
  };

  const allPeopleIds = peopleWithColors.map((p: any) => p.id);
  const everyoneSelected = allPeopleIds.length > 0 && allPeopleIds.every(id => selectedPeople.includes(id));

  const handleSelectEveryone = () => {
    if (everyoneSelected) {
      setSelectedPeople([]);
      setAssignedQuantities({});
    } else {
      setSelectedPeople(allPeopleIds);
      if (splitMode === "share") {
        const newQtys: Record<string, number> = {};
        allPeopleIds.forEach(id => { newQtys[id] = assignedQuantities[id] || 1; });
        setAssignedQuantities(newQtys);
      }
    }
  };

  const handleSplitModeChange = (mode: "equal" | "share") => {
    setSplitMode(mode);
    if (mode === "equal") {
      setAssignedQuantities({});
    } else {
      const newQtys: Record<string, number> = {};
      selectedPeople.forEach(pid => { newQtys[pid] = assignedQuantities[pid] || 1; });
      setAssignedQuantities(newQtys);
    }
  };

  const updateShare = (personId: string, value: number) => {
    const clamped = Math.max(1, Math.round(value));
    setAssignedQuantities({ ...assignedQuantities, [personId]: clamped });
  };

  const totalShares = selectedPeople.reduce((s, pid) => s + (assignedQuantities[pid] ?? 1), 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select who is splitting this item
      </p>

      {/* People chip selector */}
      <div className="flex flex-wrap gap-2 items-center">
        {allPeopleIds.length > 1 && (
          <button
            type="button"
            onClick={handleSelectEveryone}
            data-testid="button-select-everyone"
            className={`flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-medium border transition-colors ${
              everyoneSelected
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-foreground border-border hover-elevate"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Everyone
          </button>
        )}
        {peopleWithColors.map((person: any) => (
          <PersonChip
            key={person.id}
            name={person.name}
            initials={person.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
            color={person.color}
            selected={selectedPeople.includes(person.id)}
            onSelect={() => handleTogglePerson(person.id)}
          />
        ))}
        <AddPersonPanel
          receiptId={receiptId}
          receiptPeopleIds={receiptPeopleIds}
          allPeople={allPeople}
          onAdded={(id) => setSelectedPeople((prev: string[]) => [...prev, id])}
          compact
        />
      </div>

      {/* Split mode — only when 2+ people are assigned */}
      {selectedPeople.length >= 2 && (
        <div className="space-y-3">
          {/* Toggle */}
          <div className="flex gap-1 bg-muted rounded-md p-1">
            <button
              className={`flex-1 py-1.5 px-3 rounded text-sm font-medium transition-colors ${
                splitMode === "equal"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => handleSplitModeChange("equal")}
              data-testid="button-split-equal"
            >
              Split equally
            </button>
            <button
              className={`flex-1 py-1.5 px-3 rounded text-sm font-medium transition-colors ${
                splitMode === "share"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => handleSplitModeChange("share")}
              data-testid="button-split-share"
            >
              Split by share
            </button>
          </div>

          {/* Share weight controls */}
          {splitMode === "share" && (
            <div className="space-y-1">
              {selectedPeople.map(pid => {
                const person = peopleWithColors.find((p: any) => p.id === pid);
                if (!person) return null;
                const weight = assignedQuantities[pid] ?? 1;
                const pct = totalShares > 0 ? Math.round((weight / totalShares) * 100) : 0;
                return (
                  <div key={pid} className="flex items-center gap-3 py-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: person.color }}
                    >
                      {person.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <span className="flex-1 text-sm font-medium">{person.name}</span>
                    <span className="text-xs text-muted-foreground w-9 text-right tabular-nums">
                      {pct}%
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => updateShare(pid, weight - 1)}
                        disabled={weight <= 1}
                        data-testid={`button-share-minus-${pid}`}
                      >
                        <span className="text-base leading-none select-none">−</span>
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums" data-testid={`text-share-${pid}`}>
                        {weight}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => updateShare(pid, weight + 1)}
                        data-testid={`button-share-plus-${pid}`}
                      >
                        <span className="text-base leading-none select-none">+</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
  const [editItemData, setEditItemData] = useState<{ name: string; quantity: number; price: string; category?: string | null }>({ name: "", quantity: 1, price: "", category: null });
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
  const [showRescanConfirm, setShowRescanConfirm] = useState(false);
  const [addItemBottomSheetOpen, setAddItemBottomSheetOpen] = useState(false);
  const [newItemData, setNewItemData] = useState({ name: "", quantity: 1, price: "" });
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [bulkAssignMode, setBulkAssignMode] = useState(false);
  const [bulkSelectedItems, setBulkSelectedItems] = useState<Set<string>>(new Set());
  const [bulkAssignSheetOpen, setBulkAssignSheetOpen] = useState(false);
  const [bulkSelectedPeople, setBulkSelectedPeople] = useState<string[]>([]);
  const [bulkAssignedQuantities, setBulkAssignedQuantities] = useState<Record<string, number>>({});
  const [bulkCategorizeSheetOpen, setBulkCategorizeSheetOpen] = useState(false);

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

  // Fall back to receipt.imageUrl (object storage) when session storage is cleared
  useEffect(() => {
    if (!scannedImageUrl && receipt?.imageUrl) {
      setScannedImageUrl(receipt.imageUrl);
    }
  }, [receipt?.imageUrl, scannedImageUrl]);

  const { data: items = [] } = useQuery<ReceiptItem[]>({
    queryKey: ["/api/receipts", receiptId, "items"],
  });

  // Fetch people on this specific receipt
  const { data: receiptPeople = [] } = useQuery<Person[]>({
    queryKey: ["/api/receipts", receiptId, "people"],
  });

  // ReScan mutation: re-runs OCR on the stored image, replacing all items
  const rescanMutation = useMutation({
    mutationFn: async () => {
      // Get image as base64: prefer session storage, fall back to fetching from URL
      let base64: string;
      const sessionBase64 = sessionStorage.getItem(`scanned_image_${receiptId}`);
      if (sessionBase64) {
        // Data URL format: "data:image/jpeg;base64,<data>"
        base64 = sessionBase64.includes(",") ? sessionBase64.split(",")[1] : sessionBase64;
      } else if (scannedImageUrl) {
        // Fetch from object storage URL and convert to base64
        const resp = await fetch(scannedImageUrl);
        if (!resp.ok) throw new Error("Could not load receipt image for re-scan");
        const blob = await resp.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.includes(",") ? result.split(",")[1] : result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        throw new Error("No scanned image available for re-scan");
      }

      // Call the OCR API
      const parsed = await apiRequest("/api/scan-receipt", "POST", { image: base64 });

      // Validate items is actually an array with entries
      const newItems: Array<{ name: string; quantity: number; price: number }> = Array.isArray(parsed.items) ? parsed.items : [];
      if (newItems.length === 0) {
        throw new Error("No items detected in the image");
      }

      // Update receipt fields (name, subtotal, tax, tip, total)
      const receiptUpdate: Record<string, string> = {};
      if (parsed.restaurantName) receiptUpdate.restaurantName = String(parsed.restaurantName);
      if (parsed.subtotal != null) receiptUpdate.subtotal = Number(parsed.subtotal).toFixed(2);
      if (parsed.tax != null) receiptUpdate.tax = Number(parsed.tax).toFixed(2);
      if (parsed.tip != null) receiptUpdate.tip = Number(parsed.tip).toFixed(2);
      if (parsed.total != null) receiptUpdate.total = Number(parsed.total).toFixed(2);
      if (Object.keys(receiptUpdate).length > 0) {
        await apiRequest(`/api/receipts/${receiptId}`, "PATCH", receiptUpdate);
      }

      // Fetch the live item list so we have current IDs, then delete each one
      const liveItems: Array<{ id: string }> = await apiRequest(`/api/receipts/${receiptId}/items`, "GET");
      await Promise.all(liveItems.map((it) => apiRequest(`/api/items/${it.id}`, "DELETE")));

      // Insert all freshly-parsed items
      for (const item of newItems) {
        await apiRequest(`/api/receipts/${receiptId}/items`, "POST", {
          name: String(item.name),
          quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
          price: Number(item.price).toFixed(2),
        });
      }

      return { ...parsed, items: newItems };
    },
    onSuccess: (parsed) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
      setShowScannedImage(false);
      setShowRescanConfirm(false);
      toast({
        title: "Receipt re-parsed",
        description: `Found ${parsed.items.length} item${parsed.items.length === 1 ? "" : "s"}.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Re-scan failed",
        description: err.message,
        variant: "destructive",
      });
    },
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

  const displayNames = useMemo(() => getDisplayNames(peopleWithColors), [peopleWithColors]);

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
    mutationFn: async ({ itemId, data }: { itemId: string; data: { name: string; quantity: number; price: string; category?: string | null } }) => {
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

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ itemIds, assignedTo, assignedQuantities }: { itemIds: string[]; assignedTo: string[]; assignedQuantities: Record<string, number> }) => {
      await Promise.all(itemIds.map(id => apiRequest(`/api/items/${id}`, "PATCH", { assignedTo, assignedQuantities })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
      const n = bulkSelectedItems.size;
      toast({ title: `Assigned ${n} item${n !== 1 ? "s" : ""}` });
      exitBulkMode();
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign items", description: error.message, variant: "destructive" });
    },
  });

  const bulkCategorizeMutation = useMutation({
    mutationFn: async ({ itemIds, category }: { itemIds: string[]; category: string }) => {
      await Promise.all(itemIds.map(id => apiRequest(`/api/items/${id}`, "PATCH", { category })));
    },
    onError: (error: any) => {
      toast({ title: "Failed to categorize items", description: error.message, variant: "destructive" });
    },
  });

  const enterBulkMode = (initialItemId?: string) => {
    setBulkAssignMode(true);
    setBulkSelectedItems(initialItemId ? new Set([initialItemId]) : new Set());
    setBulkSelectedPeople([]);
    setBulkAssignedQuantities({});
  };

  const exitBulkMode = () => {
    setBulkAssignMode(false);
    setBulkSelectedItems(new Set());
    setBulkAssignSheetOpen(false);
    setBulkCategorizeSheetOpen(false);
    setBulkSelectedPeople([]);
    setBulkAssignedQuantities({});
  };

  const toggleBulkItem = (itemId: string) => {
    setBulkSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleBulkAssignClick = () => {
    setBulkSelectedPeople([]);
    setBulkAssignedQuantities({});
    setBulkAssignSheetOpen(true);
  };

  const handleSaveBulkAssignment = () => {
    bulkAssignMutation.mutate({
      itemIds: Array.from(bulkSelectedItems),
      assignedTo: bulkSelectedPeople,
      assignedQuantities: bulkAssignedQuantities,
    });
    setBulkAssignSheetOpen(false);
  };

  const categorizeMutation = useMutation({
    mutationFn: () => apiRequest(`/api/receipts/${receiptId}/categorize`, "POST", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
      toast({ title: "Items categorized", description: "Items sorted into Meals, Drinks, and Desserts" });
    },
    onError: (error: any) => {
      toast({ title: "Categorization failed", description: error.message, variant: "destructive" });
    },
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
        price: item.price,
        category: item.category ?? null,
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
      setEditItemData({ name: "", quantity: 1, price: "", category: null });
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
    // Pre-select whoever is already marked as payer
    if (receipt?.paidById) {
      const currentPayer = peopleWithColors.find(p => p.id === receipt.paidById);
      setSelectedPayerPersonId(receipt.paidById);
      setPayerVenmoInput(currentPayer?.venmoUsername || "");
      setPaymentAmount(total.toFixed(2));
    }
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

    // Keep paidById in sync with payment payer
    updatePaidByMutation.mutate({ paidById: selectedPayerPersonId });

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

  const CATEGORY_TABS = ["meal", "drink", "dessert", "other"] as const;
  const hasCategoryData = items.some(item => item.category);
  const showCategoryGroups = hasCategoryData && selectedTab !== "unassigned" && !CATEGORY_TABS.includes(selectedTab as any);

  // Filter items based on selected tab
  const filteredItems = selectedTab === "all"
    ? items
    : selectedTab === "unassigned"
    ? items.filter(item => (item.assignedTo as string[] || []).length === 0)
    : CATEGORY_TABS.includes(selectedTab as any)
    ? items.filter(item => item.category === selectedTab)
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
  const isPersonTab = selectedTab !== "all" && selectedTab !== "unassigned" && !CATEGORY_TABS.includes(selectedTab as any);
  const displayTotals = isPersonTab
    ? (personTotals.get(selectedTab) || { subtotal: 0, tax: 0, tip: 0, total: 0 })
    : { subtotal, tax, tip: tipAmount, total };

  const renderItemRow = (item: ReceiptItem) => {
    const assignedPeople = (item.assignedTo as string[]) || [];
    const isPersonTabCtx = !["all", "unassigned", ...CATEGORY_TABS].includes(selectedTab as any);
    let displayQuantity: string | undefined;
    let displayPrice = parseFloat(item.price) || 0;
    if (isPersonTabCtx && assignedPeople.length > 0) {
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
        displayQuantity={displayQuantity}
        bulkMode={bulkAssignMode}
        selected={bulkSelectedItems.has(item.id)}
        onLongPress={() => enterBulkMode(item.id)}
        onBulkSelect={() => toggleBulkItem(item.id)}
      />
    );
  };

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
          <div className="flex-1 text-center">
            <button 
              className="text-xl font-bold flex items-center justify-center gap-1 hover:text-primary transition-colors mx-auto"
              onClick={() => {
                setNameInput(receipt.restaurantName || "");
                setEditingName(true);
              }}
              data-testid="button-edit-name"
            >
              <span>{receipt.restaurantName || "Receipt"}</span>
              <Pencil className="h-3.5 w-3.5 opacity-50" />
            </button>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <img src={logoUrl} alt="Tab Splits" className="h-4 w-4 rounded-md" />
              <span className="text-xs font-semibold tracking-wide text-primary">Tab Splits</span>
            </div>
          </div>
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
          
          {/* Category tabs — only show after AI categorization */}
          {hasCategoryData && (
            <>
              {(["meal", "drink", "dessert", "other"] as const).map(cat => {
                const catCount = items.filter(i => i.category === cat).length;
                if (catCount === 0) return null;
                const catLabel = { meal: "Meals", drink: "Drinks", dessert: "Desserts", other: "Other" }[cat];
                return (
                  <Button
                    key={cat}
                    variant={selectedTab === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTab(cat)}
                    className="whitespace-nowrap"
                    data-testid={`tab-category-${cat}`}
                  >
                    {catLabel}
                    <span className="ml-1 opacity-60 text-xs">({catCount})</span>
                  </Button>
                );
              })}
            </>
          )}

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
                <span>{displayNames.get(person.id) ?? person.name}</span>
                <span className="font-semibold">${personTotal.total.toFixed(2)}</span>
              </Button>
            );
          })}

          {/* Manage People tab button — always at far right */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManagePeopleClick}
            className="whitespace-nowrap flex items-center gap-1.5 text-muted-foreground"
            data-testid="button-add-person-tab"
          >
            <Users className="h-3.5 w-3.5" />
            Manage
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 pb-64">
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {bulkAssignMode ? (
                  <h2 className="font-semibold text-base">
                    {bulkSelectedItems.size === 0
                      ? "Tap to select items"
                      : `${bulkSelectedItems.size} selected`}
                  </h2>
                ) : (
                  <>
                    <h2 className="font-semibold text-base truncate">
                      {selectedTab === "all"
                        ? "All Items"
                        : selectedTab === "unassigned"
                        ? "Unassigned Items"
                        : CATEGORY_TABS.includes(selectedTab as any)
                        ? ({ meal: "Meals", drink: "Drinks", dessert: "Desserts", other: "Other" } as Record<string, string>)[selectedTab]
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
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {bulkAssignMode ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exitBulkMode}
                    data-testid="button-exit-bulk-mode"
                  >
                    Cancel
                  </Button>
                ) : (
                  <>
                    {items.length > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => categorizeMutation.mutate()}
                        disabled={categorizeMutation.isPending}
                        title={hasCategoryData ? "Re-categorize items with AI" : "Categorize items with AI"}
                        data-testid="button-categorize"
                      >
                        {categorizeMutation.isPending
                          ? <RefreshCw className="h-4 w-4 animate-spin" />
                          : <Sparkles className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => enterBulkMode()}
                      title="Select multiple items to assign"
                      data-testid="button-enter-bulk-mode"
                    >
                      <ListChecks className="h-4 w-4" />
                    </Button>
                    {selectedTab === "all" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAddItemBottomSheetOpen(true)}
                        className="flex items-center gap-1"
                        data-testid="button-add-item"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Item
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className={showCategoryGroups ? "p-0" : "divide-y"}>
            {showCategoryGroups ? (
              (["meal", "drink", "dessert", "other"] as const).map(cat => {
                const catItems = filteredItems.filter(i => i.category === cat);
                if (catItems.length === 0) return null;
                const catLabel = { meal: "Meals", drink: "Drinks", dessert: "Desserts", other: "Other" }[cat];
                const selectedCount = bulkAssignMode ? catItems.filter(i => bulkSelectedItems.has(i.id)).length : 0;
                const allCatSelected = bulkAssignMode && selectedCount === catItems.length;
                const someCatSelected = bulkAssignMode && selectedCount > 0 && !allCatSelected;
                return (
                  <div key={cat}>
                    {bulkAssignMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setBulkSelectedItems(prev => {
                            const next = new Set(prev);
                            if (allCatSelected) {
                              catItems.forEach(i => next.delete(i.id));
                            } else {
                              catItems.forEach(i => next.add(i.id));
                            }
                            return next;
                          });
                        }}
                        className="w-full flex items-center gap-2 px-6 py-2 bg-muted/50 border-y first:border-t-0 hover-elevate active-elevate-2"
                        data-testid={`button-select-category-${cat}`}
                      >
                        {allCatSelected
                          ? <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                          : someCatSelected
                            ? <MinusCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        }
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex-1 text-left">
                          {catLabel}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {selectedCount > 0 ? `${selectedCount}/${catItems.length}` : catItems.length}
                        </span>
                      </button>
                    ) : (
                      <div className="px-6 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest bg-muted/50 border-y first:border-t-0">
                        {catLabel}
                      </div>
                    )}
                    <div className="divide-y px-6">
                      {catItems.map(renderItemRow)}
                    </div>
                  </div>
                );
              })
            ) : (
              <>
                {/* Select-all banner — only in bulk mode on a category tab */}
                {bulkAssignMode && CATEGORY_TABS.includes(selectedTab as any) && (() => {
                  const catLabel = { meal: "Meals", drink: "Drinks", dessert: "Desserts", other: "Other" }[selectedTab as "meal" | "drink" | "dessert" | "other"];
                  const selectedCount = filteredItems.filter(i => bulkSelectedItems.has(i.id)).length;
                  const allSelected = filteredItems.length > 0 && selectedCount === filteredItems.length;
                  const someSelected = selectedCount > 0 && !allSelected;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setBulkSelectedItems(prev => {
                          const next = new Set(prev);
                          if (allSelected) {
                            filteredItems.forEach(i => next.delete(i.id));
                          } else {
                            filteredItems.forEach(i => next.add(i.id));
                          }
                          return next;
                        });
                      }}
                      className="w-full flex items-center gap-2 px-6 py-2 bg-muted/50 border-b hover-elevate active-elevate-2"
                      data-testid={`button-select-category-${selectedTab}`}
                    >
                      {allSelected
                        ? <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        : someSelected
                          ? <MinusCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      }
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex-1 text-left">
                        {catLabel}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {selectedCount > 0 ? `${selectedCount}/${filteredItems.length}` : filteredItems.length}
                      </span>
                    </button>
                  );
                })()}
                {filteredItems.map(renderItemRow)}
              </>
            )}
          </CardContent>
        </Card>

      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4">
        <div className="space-y-3">
          {/* Bulk assign action bar */}
          {bulkAssignMode && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exitBulkMode}
                data-testid="button-cancel-bulk"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setBulkCategorizeSheetOpen(true)}
                disabled={bulkSelectedItems.size === 0 || bulkCategorizeMutation.isPending}
                data-testid="button-categorize-bulk"
              >
                Set category
              </Button>
              <Button
                className="flex-1"
                onClick={handleBulkAssignClick}
                disabled={bulkSelectedItems.size === 0 || bulkAssignMutation.isPending}
                data-testid="button-assign-bulk"
              >
                {bulkAssignMutation.isPending
                  ? "Assigning…"
                  : `Assign ${bulkSelectedItems.size}`}
              </Button>
            </div>
          )}
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
          receiptId={receiptId}
          receiptPeopleIds={peopleWithColors.map(p => p.id)}
          allPeople={allPeople}
        />
      </BottomSheet>

      {/* Bulk assign bottom sheet */}
      <BottomSheet
        open={bulkAssignSheetOpen}
        onClose={() => setBulkAssignSheetOpen(false)}
        title={`Assign ${bulkSelectedItems.size} item${bulkSelectedItems.size !== 1 ? "s" : ""} to…`}
        footer={
          <Button
            className="w-full"
            onClick={handleSaveBulkAssignment}
            disabled={bulkAssignMutation.isPending}
            data-testid="button-save-bulk-assignment"
          >
            {bulkAssignMutation.isPending ? "Assigning…" : "Assign All"}
          </Button>
        }
      >
        <AssignmentSheetBody
          selectedItemId={null}
          items={items}
          peopleWithColors={peopleWithColors}
          selectedPeople={bulkSelectedPeople}
          assignedQuantities={bulkAssignedQuantities}
          setAssignedQuantities={setBulkAssignedQuantities}
          setSelectedPeople={setBulkSelectedPeople}
          receiptId={receiptId}
          receiptPeopleIds={peopleWithColors.map(p => p.id)}
          allPeople={allPeople}
        />
      </BottomSheet>

      <BottomSheet
        open={editBottomSheetOpen}
        onClose={() => {
          setEditBottomSheetOpen(false);
          setEditItemData({ name: "", quantity: 1, price: "", category: null });
        }}
        title="Edit Item"
        footer={
          <div className="flex gap-2 w-full">
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive flex-shrink-0"
              onClick={() => {
                if (selectedItemId) {
                  handleDeleteItem(selectedItemId);
                  setEditBottomSheetOpen(false);
                  setEditItemData({ name: "", quantity: 1, price: "" });
                }
              }}
              data-testid="button-delete-item"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveEdit}
              disabled={!editItemData.name || !editItemData.price}
              data-testid="button-save-item-edit"
            >
              Save Changes
            </Button>
          </div>
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
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex gap-2 flex-wrap">
              {([
                { value: null, label: "None", Icon: Tag },
                { value: "meal", label: "Meal", Icon: UtensilsCrossed },
                { value: "drink", label: "Drink", Icon: GlassWater },
                { value: "dessert", label: "Dessert", Icon: Cake },
                { value: "other", label: "Other", Icon: Tag },
              ] as const).map(({ value, label, Icon }) => {
                const selected = (editItemData.category ?? null) === value;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setEditItemData(prev => ({ ...prev, category: value }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors
                      ${selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover-elevate"
                      }`}
                    data-testid={`button-category-${value ?? "none"}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* Bulk categorize sheet */}
      <BottomSheet
        open={bulkCategorizeSheetOpen}
        onClose={() => setBulkCategorizeSheetOpen(false)}
        title={`Categorize ${bulkSelectedItems.size} item${bulkSelectedItems.size !== 1 ? "s" : ""}`}
      >
        <div className="space-y-2 pb-2">
          {([
            { value: "meal", label: "Meal", Icon: UtensilsCrossed, description: "Entrees, appetizers, sides, salads" },
            { value: "drink", label: "Drink", Icon: GlassWater, description: "Beverages, cocktails, coffee, tea" },
            { value: "dessert", label: "Dessert", Icon: Cake, description: "Ice cream, cake, pastries, sweets" },
            { value: "other", label: "Other", Icon: Tag, description: "Service charges, fees, non-food" },
          ] as const).map(({ value, label, Icon, description }) => {
            const isPendingThis = bulkCategorizeMutation.isPending && bulkCategorizeMutation.variables?.category === value;
            return (
              <button
                key={value}
                type="button"
                onClick={async () => {
                  if (bulkCategorizeMutation.isPending) return;
                  const n = bulkSelectedItems.size;
                  const ids = Array.from(bulkSelectedItems);
                  try {
                    await bulkCategorizeMutation.mutateAsync({ itemIds: ids, category: value });
                    await queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
                    toast({ title: `Categorized ${n} item${n !== 1 ? "s" : ""}` });
                    setBulkCategorizeSheetOpen(false);
                    exitBulkMode();
                  } catch {
                    // error toast handled by onError
                  }
                }}
                className={`flex items-center gap-4 w-full p-4 rounded-lg border bg-background text-left transition-opacity ${bulkCategorizeMutation.isPending ? "opacity-60" : "hover-elevate active-elevate-2"}`}
                data-testid={`button-bulk-category-${value}`}
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  {isPendingThis
                    ? <RefreshCw className="h-5 w-5 text-foreground animate-spin" />
                    : <Icon className="h-5 w-5 text-foreground" />
                  }
                </div>
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-sm text-muted-foreground">{description}</div>
                </div>
              </button>
            );
          })}
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
              {/* QR Code */}
              {qrCodeDataUrl && (
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-xl">
                    <img src={qrCodeDataUrl} alt="QR Code" className="w-48 h-48" data-testid="img-qr-code" />
                  </div>
                </div>
              )}

              {/* Copy link */}
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  const shareUrl = `${window.location.origin}/share/${activeShareToken}`;
                  await navigator.clipboard.writeText(shareUrl);
                  setUrlCopied(true);
                  toast({ title: "Link copied!" });
                  setTimeout(() => setUrlCopied(false), 2000);
                }}
                data-testid="button-copy-url"
              >
                {urlCopied ? (
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {urlCopied ? "Copied!" : "Copy Link"}
              </Button>

              {/* Send via text — only shown when someone has a phone number */}
              {peopleWithColors.filter(p => p.phone).length > 0 && (
                <>
                  <div className="border-t" />
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Send via Text</p>
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
                  </div>
                </>
              )}
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
        onClose={() => setManagePeopleBottomSheetOpen(false)}
        title="Manage People"
      >
        <div className="space-y-3">
          {peopleWithColors.length === 0 && (
            <p className="text-sm text-muted-foreground">No one on this bill yet.</p>
          )}

          {peopleWithColors.map((person) => {
            const hasAssignedItems = items.some(item =>
              (item.assignedTo as string[] || []).includes(person.id)
            );
            const initials = person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            return (
              <div
                key={person.id}
                className="flex items-center gap-3 p-3 rounded-lg border"
                data-testid={`person-item-${person.id}`}
              >
                <div
                  className="w-8 h-8 rounded-full text-white text-sm font-semibold flex items-center justify-center shrink-0"
                  style={{ backgroundColor: person.color }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{person.name}</p>
                  {person.phone && (
                    <p className="text-xs text-muted-foreground">{person.phone}</p>
                  )}
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

          <AddPersonPanel
            receiptId={receiptId}
            receiptPeopleIds={peopleWithColors.map(p => p.id)}
            allPeople={allPeople}
            onAdded={() => {}}
          />
        </div>
      </BottomSheet>

      <BottomSheet
        open={paymentsBottomSheetOpen}
        onClose={() => {
          setPaymentsBottomSheetOpen(false);
          setSelectedPayerPersonId("");
          setPaymentAmount("");
          setPayerVenmoInput("");
        }}
        title="Who Paid?"
      >
        <div className="space-y-3">
          {peopleWithColors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Add people to the bill first</p>
          ) : (
            peopleWithColors.map((person) => {
              const isSelected = selectedPayerPersonId === person.id;
              const initials = person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
              return (
                <div key={person.id}>
                  <button
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover-elevate'
                    }`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedPayerPersonId("");
                        setPayerVenmoInput("");
                        setPaymentAmount("");
                        updatePaidByMutation.mutate({ paidById: null });
                      } else {
                        setSelectedPayerPersonId(person.id);
                        setPayerVenmoInput(person.venmoUsername || "");
                        setPaymentAmount(total.toFixed(2));
                        updatePaidByMutation.mutate({ paidById: person.id });
                      }
                    }}
                    data-testid={`button-select-payer-${person.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full text-white text-sm font-semibold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: person.color }}
                      >
                        {initials}
                      </div>
                      <span className="font-medium text-sm">{person.name}</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </button>

                  {/* Inline form — only for selected payer */}
                  {isSelected && (
                    <div className="mt-2 mx-1 space-y-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                        <Input
                          type="text"
                          placeholder="venmo username (optional)"
                          className="pl-7 text-sm"
                          value={payerVenmoInput}
                          onChange={(e) => setPayerVenmoInput(e.target.value.replace(/^@/, ''))}
                          data-testid="input-payer-venmo"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="text-sm"
                          data-testid="input-payment-amount"
                        />
                        <Button
                          onClick={handleAddPayment}
                          disabled={!paymentAmount || createPaymentMutation.isPending}
                          data-testid="button-add-payment"
                        >
                          {createPaymentMutation.isPending ? "…" : "Record"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Recorded payments */}
          {payments.length > 0 && (
            <>
              <div className="border-t pt-1" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recorded</p>
              {payments.map((payment) => {
                const payer = getPersonById(payment.personId);
                return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`payment-${payment.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {payer && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                          style={{ backgroundColor: payer.color }}
                        >
                          {getInitialsForPerson(payer.id)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{payer?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">${parseFloat(payment.amount).toFixed(2)}</p>
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
            </>
          )}
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

      <Dialog open={showScannedImage} onOpenChange={(open) => { setShowScannedImage(open); setShowRescanConfirm(false); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Scanned Receipt Image</DialogTitle>
          </DialogHeader>
          {scannedImageUrl && (
            <div className="space-y-3">
              <div className="relative overflow-y-auto max-h-[60vh]">
                <img
                  src={scannedImageUrl}
                  alt="Scanned receipt"
                  className="w-full h-auto rounded-lg"
                />
              </div>

              {!showRescanConfirm ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowRescanConfirm(true)}
                  data-testid="button-initiate-rescan"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-parse with AI
                </Button>
              ) : (
                <div className="space-y-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    Replace all current items?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    All items and assignments will be removed and replaced with whatever AI reads from the image. This cannot be undone.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setShowRescanConfirm(false)}
                      disabled={rescanMutation.isPending}
                      data-testid="button-rescan-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => rescanMutation.mutate()}
                      disabled={rescanMutation.isPending}
                      data-testid="button-rescan-confirm"
                    >
                      {rescanMutation.isPending ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Scanning…
                        </>
                      ) : (
                        "Re-parse Receipt"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
