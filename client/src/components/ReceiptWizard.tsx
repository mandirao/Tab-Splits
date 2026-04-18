import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import BottomSheet from "@/components/BottomSheet";
import PersonChip from "@/components/PersonChip";
import TipCalculator from "@/components/TipCalculator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Upload, Loader2, RotateCw, RotateCcw, Check, ArrowLeft, ArrowRight,
  Sparkles, Users, QrCode, Plus, X, CheckCircle2, Circle, AlertTriangle,
  Pencil, Trash2, Phone, MinusCircle, UserPlus,
} from "lucide-react";
import QRCodeLib from "qrcode";
import type { Receipt, ReceiptItem, Person } from "@shared/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const PERSON_COLORS = [
  "hsl(221, 83%, 53%)", "hsl(142, 71%, 45%)", "hsl(37, 91%, 55%)",
  "hsl(0, 72%, 51%)", "hsl(271, 81%, 56%)", "hsl(199, 89%, 48%)",
  "hsl(24, 95%, 53%)", "hsl(330, 81%, 60%)", "hsl(168, 83%, 35%)",
  "hsl(60, 97%, 37%)",
];

const STEP_LABELS = ["Scan", "Items", "Sort", "Diners", "Assign", "Tip", "Paid by", "Share"];
const STEP_SUBTITLES = [
  "Take or upload a photo of your receipt",
  "Verify everything looks right",
  "Organize items by category",
  "Who's splitting the bill?",
  "Match items to people",
  "Confirm the tip amount",
  "Who covered the bill?",
  "Send everyone their total",
];

const CAT_LABELS: Record<string, string> = {
  appetizer: "Appetizers", meal: "Meals", drink: "Drinks", dessert: "Desserts", other: "Other",
};

const SERVICE_CHARGE_TERMS = ["gratuity", "service charge", "service fee", "auto-grat", "auto grat", "autogratuity"];

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Main Wizard Component ────────────────────────────────────────────────────

interface ReceiptWizardProps {
  open: boolean;
  onClose: (receiptId?: string) => void;
  initialReceiptId?: string;
}

export default function ReceiptWizard({ open, onClose, initialReceiptId }: ReceiptWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  // Step 0 scan state
  const [previewUrl, setPreviewUrl] = useState("");
  const [rotation, setRotation] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Step 2 categorize
  const [isCategorizing, setIsCategorizing] = useState(false);

  // Step 4 assign
  const [assignSheet, setAssignSheet] = useState<{
    label: string; itemIds: string[];
  } | null>(null);
  const [assignPeople, setAssignPeople] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Step 5 tip
  const [tipPct, setTipPct] = useState(20);
  const [tipAmt, setTipAmt] = useState(0);
  const [tipSaving, setTipSaving] = useState(false);

  // Step 6 payer
  const [payerId, setPayerId] = useState<string | null>(null);
  const [venmoInput, setVenmoInput] = useState("");

  // Step 7 share
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Reset wizard on open
  useEffect(() => {
    if (open) {
      if (initialReceiptId) {
        // Launched from an existing receipt — skip the scan step
        setReceiptId(initialReceiptId);
        setStep(1);
      } else {
        setStep(0);
        setReceiptId(null);
        setPreviewUrl("");
        setRotation(0);
      }
      setShareToken(null);
      setQrDataUrl(null);
      setPayerId(null);
      setVenmoInput("");
    }
  }, [open, initialReceiptId]);

  // ─── Data queries ────────────────────────────────────────────────────────
  const { data: receipt } = useQuery<Receipt>({
    queryKey: ["/api/receipts", receiptId],
    queryFn: () => apiRequest(`/api/receipts/${receiptId}`, "GET"),
    enabled: !!receiptId,
  });

  const { data: items = [], refetch: refetchItems } = useQuery<ReceiptItem[]>({
    queryKey: ["/api/receipts", receiptId, "items"],
    queryFn: () => apiRequest(`/api/receipts/${receiptId}/items`, "GET"),
    enabled: !!receiptId,
  });

  const { data: receiptPeople = [] } = useQuery<Person[]>({
    queryKey: ["/api/receipts", receiptId, "people"],
    queryFn: () => apiRequest(`/api/receipts/${receiptId}/people`, "GET"),
    enabled: !!receiptId,
  });

  const { data: allPeople = [] } = useQuery<Person[]>({
    queryKey: ["/api/people"],
    enabled: !!receiptId,
  });

  const peopleWithColors = receiptPeople.map((p, i) => ({
    ...p,
    color: PERSON_COLORS[i % PERSON_COLORS.length],
  }));

  const getPersonColor = (pid: string) =>
    peopleWithColors.find(p => p.id === pid)?.color ?? PERSON_COLORS[0];

  const availablePeople = allPeople.filter(p => !receiptPeople.find(rp => rp.id === p.id));

  // Tip: init from receipt when it loads (Step 5)
  useEffect(() => {
    if (!receipt) return;
    const sub = parseFloat(receipt.subtotal) || 0;
    const tip = parseFloat(receipt.tip) || 0;
    if (tip > 0) {
      setTipAmt(tip);
      setTipPct(sub > 0 ? Math.round((tip / sub) * 1000) / 10 : 20);
    } else {
      setTipPct(20);
      setTipAmt(sub * 0.2);
    }
  }, [receipt?.id]);

  // Generate share token when reaching Step 7
  useEffect(() => {
    if (step === 7 && receiptId && !shareToken) {
      apiRequest(`/api/receipts/${receiptId}/generate-share-token`, "POST", {})
        .then(async (data: { shareToken: string }) => {
          setShareToken(data.shareToken);
          const url = `${window.location.origin}/share/${data.shareToken}`;
          const qr = await QRCodeLib.toDataURL(url, { width: 240, margin: 2 });
          setQrDataUrl(qr);
        })
        .catch(() => {});
    }
  }, [step, receiptId]);

  // ─── Step 0: Scan helpers ─────────────────────────────────────────────────
  const getRotatedBase64 = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        if (rotation === 90 || rotation === 270) {
          canvas.width = img.height; canvas.height = img.width;
        } else {
          canvas.width = img.width; canvas.height = img.height;
        }
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas.toDataURL("image/jpeg", 0.95).split(",")[1]);
      };
      img.onerror = reject;
      img.src = previewUrl;
    });

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const base64Image = await getRotatedBase64();
      const response = await apiRequest("/api/scan-receipt", "POST", { image: base64Image });

      const sub = response.subtotal || 0;
      const newReceipt: Receipt = await apiRequest("/api/receipts", "POST", {
        restaurantName: response.restaurantName || "Unknown Restaurant",
        subtotal: sub.toFixed(2),
        tax: (response.tax || 0).toFixed(2),
        tip: (response.tip || 0).toFixed(2),
        total: (response.total || 0).toFixed(2),
      });

      if (response.items?.length) {
        for (const item of response.items) {
          await apiRequest(`/api/receipts/${newReceipt.id}/items`, "POST", {
            name: item.name, quantity: item.quantity || 1, price: item.price.toFixed(2),
          });
        }
      }

      const rotatedDataUrl = `data:image/jpeg;base64,${base64Image}`;
      sessionStorage.setItem(`scanned_image_${newReceipt.id}`, rotatedDataUrl);

      // Upload to storage (best-effort)
      try {
        const bytes = atob(base64Image);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const file = new File([arr], `receipt-${newReceipt.id}.jpg`, { type: "image/jpeg" });
        const urlRes = await fetch("/api/uploads/request-url", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        });
        if (urlRes.ok) {
          const { uploadURL, objectPath } = await urlRes.json();
          const up = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          if (up.ok) await apiRequest(`/api/receipts/${newReceipt.id}`, "PATCH", { imageUrl: objectPath });
        }
      } catch { /* silent */ }

      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      setReceiptId(newReceipt.id);

      const ocrtip = response.tip || 0;
      setTipPct(ocrtip > 0 && sub > 0 ? Math.round((ocrtip / sub) * 1000) / 10 : 20);
      setTipAmt(ocrtip > 0 ? ocrtip : sub * 0.2);
      setStep(1);
    } catch (err: any) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  const createManual = async () => {
    setIsScanning(true);
    try {
      const newReceipt: Receipt = await apiRequest("/api/receipts", "POST", {
        restaurantName: "New Receipt", subtotal: "0.00", tax: "0.00", tip: "0.00", total: "0.00",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      setReceiptId(newReceipt.id);
      setTipPct(20);
      setTipAmt(0);
      setStep(1);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  // ─── Step 2: Categorize ───────────────────────────────────────────────────
  const handleCategorize = async () => {
    if (!receiptId) return;
    setIsCategorizing(true);
    try {
      await apiRequest(`/api/receipts/${receiptId}/categorize`, "POST", {});
      await refetchItems();
      toast({ title: "Items categorized!" });
    } catch (err: any) {
      toast({ title: "Categorization failed", description: err.message, variant: "destructive" });
    } finally {
      setIsCategorizing(false);
    }
  };

  // ─── Step 3: Diners ───────────────────────────────────────────────────────
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonPhone, setNewPersonPhone] = useState("");
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [addMode, setAddMode] = useState<"contacts" | "manual">("manual");
  const [pendingContact, setPendingContact] = useState<{ name: string; phone: string } | null>(null);
  const contactsSupported = typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

  const handleOpenContacts = async () => {
    try {
      const contacts = await (navigator as any).contacts.select(["name", "tel"], { multiple: false });
      if (contacts?.length > 0) {
        const c = contacts[0];
        setPendingContact({ name: c.name?.[0] ?? "", phone: c.tel?.[0] ?? "" });
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast({ title: "Could not open contacts", description: "Try adding manually instead.", variant: "destructive" });
      }
    }
  };

  const openAddPerson = () => {
    setAddMode(contactsSupported ? "contacts" : "manual");
    setPendingContact(null);
    setNewPersonName("");
    setNewPersonPhone("");
    setIsAddingPerson(true);
  };

  const addPersonMutation = useMutation({
    mutationFn: async ({ name, phone }: { name: string; phone?: string }) => {
      const person: Person = await apiRequest("/api/people", "POST", { name, phone: phone || null, isRegular: 1 });
      await apiRequest(`/api/receipts/${receiptId}/people`, "POST", { personId: person.id });
      return person;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setNewPersonName(""); setNewPersonPhone(""); setIsAddingPerson(false);
      setPendingContact(null);
    },
    onError: (err: any) => toast({ title: "Failed to add person", description: err.message, variant: "destructive" }),
  });

  const addExistingToReceipt = async (personId: string) => {
    try {
      await apiRequest(`/api/receipts/${receiptId}/people`, "POST", { personId });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "people"] });
    } catch { toast({ title: "Failed to add diner", variant: "destructive" }); }
  };

  const removeFromReceipt = async (personId: string) => {
    try {
      await apiRequest(`/api/receipts/${receiptId}/people/${personId}`, "DELETE");
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "people"] });
    } catch { /* ignore */ }
  };

  // ─── Step 4: Assign ───────────────────────────────────────────────────────
  const openAssignSheet = (label: string, itemIds: string[]) => {
    setAssignPeople([]);
    setAssignSheet({ label, itemIds });
  };

  const confirmAssign = async () => {
    if (!assignSheet || assignPeople.length === 0) return;
    setIsAssigning(true);
    try {
      await Promise.all(
        assignSheet.itemIds.map(id =>
          apiRequest(`/api/items/${id}`, "PATCH", { assignedTo: assignPeople, assignedQuantities: {} })
        )
      );
      await queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
      toast({ title: `Assigned ${assignSheet.itemIds.length} item${assignSheet.itemIds.length !== 1 ? "s" : ""}` });
      setAssignSheet(null);
    } catch (err: any) {
      toast({ title: "Assignment failed", description: err.message, variant: "destructive" });
    } finally {
      setIsAssigning(false);
    }
  };

  const everyoneSelected = peopleWithColors.length > 0 && peopleWithColors.every(p => assignPeople.includes(p.id));

  const toggleAssignPerson = (pid: string) => {
    setAssignPeople(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  };

  const toggleEveryone = () => {
    if (everyoneSelected) {
      setAssignPeople([]);
    } else {
      setAssignPeople(peopleWithColors.map(p => p.id));
    }
  };

  // ─── Step 5: Tip save ─────────────────────────────────────────────────────
  const saveTip = async () => {
    if (!receiptId || !receipt) return;
    setTipSaving(true);
    try {
      const sub = parseFloat(receipt.subtotal) || 0;
      const tax = parseFloat(receipt.tax) || 0;
      await apiRequest(`/api/receipts/${receiptId}`, "PATCH", {
        tip: tipAmt.toFixed(2),
        total: (sub + tax + tipAmt).toFixed(2),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
    } catch { toast({ title: "Failed to save tip", variant: "destructive" }); }
    finally { setTipSaving(false); }
  };

  // ─── Step 6: Payer save ───────────────────────────────────────────────────
  const savePayer = async () => {
    if (!receiptId || !payerId) return;
    try {
      if (venmoInput.trim()) {
        await apiRequest(`/api/people/${payerId}`, "PATCH", {
          venmoUsername: venmoInput.trim().replace("@", ""),
        });
      }
      await apiRequest(`/api/receipts/${receiptId}`, "PATCH", { paidById: payerId });
      await queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "people"] });
    } catch { /* ignore */ }
  };

  // ─── Navigation ───────────────────────────────────────────────────────────
  const handleNext = async () => {
    if (step === 5) await saveTip();
    if (step === 6) await savePayer();
    if (step === 7) { onClose(receiptId ?? undefined); return; }
    setStep(s => s + 1);
  };

  const nextDisabled = (() => {
    if (step === 0) return !previewUrl || isScanning;
    if (step === 6) return !payerId;
    return false;
  })();

  if (!open) return null;

  // ─── Derived data for steps ───────────────────────────────────────────────
  const sub = parseFloat(receipt?.subtotal ?? "0") || 0;
  const tax = parseFloat(receipt?.tax ?? "0") || 0;
  const itemsSubtotal = items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);
  const subtotalDiff = Math.abs(itemsSubtotal - sub);
  const hasCategoryData = items.some(i => i.category);
  const hasServiceCharge = items.some(i =>
    SERVICE_CHARGE_TERMS.some(term => i.name.toLowerCase().includes(term))
  );
  const assignedCount = items.filter(i => (i.assignedTo as string[])?.length > 0).length;

  // Per-person totals for Step 5 preview
  const perPersonTotals: { person: typeof peopleWithColors[0]; subtotal: number; tax: number; tip: number; total: number }[] = [];
  if (sub > 0) {
    peopleWithColors.forEach(person => {
      let psub = 0;
      items.forEach(item => {
        const assigned = (item.assignedTo as string[]) || [];
        if (assigned.includes(person.id)) {
          psub += parseFloat(item.price) * item.quantity / assigned.length;
        }
      });
      const share = sub > 0 ? psub / sub : 0;
      perPersonTotals.push({
        person,
        subtotal: psub,
        tax: tax * share,
        tip: tipAmt * share,
        total: psub + tax * share + tipAmt * share,
      });
    });
  }

  const shareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : "";

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="wizard-overlay">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 pt-safe-top pt-4 pb-2 border-b bg-card">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Step {step + 1} of 8</p>
            <h1 className="text-lg font-bold leading-tight">{STEP_LABELS[step]}</h1>
            <p className="text-xs text-muted-foreground">{STEP_SUBTITLES[step]}</p>
          </div>
          {receiptId && (
            <Button size="sm" variant="ghost" onClick={() => onClose(receiptId)} className="text-xs text-muted-foreground" data-testid="button-exit-wizard">
              Exit to receipt
            </Button>
          )}
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${((step + 1) / 8) * 100}%` }} />
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto scrollbar-hide pb-0.5">
          {STEP_LABELS.map((label, i) => (
            <span key={label} className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              {i < step && "✓ "}{label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Step Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ────────────────────────────── STEP 0: SCAN ────────────────────────────── */}
        {step === 0 && (
          <div className="p-4 space-y-4">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="input-camera"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setPreviewUrl(URL.createObjectURL(f)); setRotation(0); } }} />
            <input ref={uploadRef} type="file" accept="image/*" className="hidden" data-testid="input-upload"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setPreviewUrl(URL.createObjectURL(f)); setRotation(0); } }} />

            {!previewUrl ? (
              <Card>
                <CardContent className="p-6 space-y-3">
                  <Button className="w-full h-14" onClick={() => cameraRef.current?.click()} data-testid="button-take-photo">
                    <Camera className="h-5 w-5 mr-2" /> Take Photo
                  </Button>
                  <Button variant="outline" className="w-full h-14" onClick={() => uploadRef.current?.click()} data-testid="button-upload-image">
                    <Upload className="h-5 w-5 mr-2" /> Upload Image
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
                  </div>
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={createManual} disabled={isScanning} data-testid="button-manual-entry">
                    {isScanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Enter manually
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="rounded-lg overflow-hidden bg-muted">
                    <img src={previewUrl} alt="Receipt" className="w-full max-h-80 object-contain transition-transform duration-300" style={{ transform: `rotate(${rotation}deg)` }} data-testid="img-receipt-preview" />
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Button size="icon" variant="outline" onClick={() => setRotation(r => (r - 90 + 360) % 360)} disabled={isScanning} data-testid="button-rotate-left"><RotateCcw className="h-4 w-4" /></Button>
                    <span className="text-sm text-muted-foreground w-16 text-center">{rotation === 0 ? "Portrait" : `${rotation}°`}</span>
                    <Button size="icon" variant="outline" onClick={() => setRotation(r => (r + 90) % 360)} disabled={isScanning} data-testid="button-rotate-right"><RotateCw className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setPreviewUrl(""); setRotation(0); }} disabled={isScanning} data-testid="button-retake">Retake</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="text-xs text-muted-foreground space-y-1 px-1">
              <p className="font-medium text-foreground">Tips for best results</p>
              <p>• Lay the receipt flat with good lighting</p>
              <p>• Include the entire receipt in the frame</p>
              <p>• Avoid shadows and glare</p>
            </div>
          </div>
        )}

        {/* ────────────────────────────── STEP 1: REVIEW ────────────────────────────── */}
        {step === 1 && <ReviewItemsStep receiptId={receiptId!} items={items} receipt={receipt} subtotalDiff={subtotalDiff} />}

        {/* ────────────────────────────── STEP 2: CATEGORIZE ────────────────────────────── */}
        {step === 2 && (
          <div className="p-4 space-y-4">
            <Button className="w-full h-12" onClick={handleCategorize} disabled={isCategorizing || items.length === 0} data-testid="button-auto-categorize">
              {isCategorizing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Categorizing…</> : <><Sparkles className="h-4 w-4 mr-2" />Auto-categorize with AI</>}
            </Button>
            {hasCategoryData && (
              <p className="text-xs text-muted-foreground text-center">AI has grouped your items below. Tap any item to adjust its category.</p>
            )}
            <Card>
              <CardContent className="p-0 divide-y">
                {items.length === 0 && <p className="p-4 text-muted-foreground text-sm">No items yet.</p>}
                {(["appetizer", "meal", "drink", "dessert", "other", "__none__"] as const).map(cat => {
                  const catItems = cat === "__none__" ? items.filter(i => !i.category) : items.filter(i => i.category === cat);
                  if (catItems.length === 0) return null;
                  const label = cat === "__none__" ? "Uncategorized" : CAT_LABELS[cat];
                  return (
                    <div key={cat}>
                      <div className="px-4 py-1.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
                      {catItems.map(item => (
                        <CategoryItemRow key={item.id} item={item} receiptId={receiptId!} onUpdated={refetchItems} />
                      ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ────────────────────────────── STEP 3: DINERS ────────────────────────────── */}
        {step === 3 && (
          <div className="p-4 space-y-4">
            {/* Current diners on this receipt */}
            {receiptPeople.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">On this tab</p>
                  <div className="space-y-2">
                    {peopleWithColors.map(person => (
                      <div key={person.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0" style={{ backgroundColor: person.color }}>
                            {getInitials(person.name)}
                          </div>
                          <span className="font-medium text-sm">{person.name}</span>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => removeFromReceipt(person.id)} className="h-8 w-8 text-muted-foreground" data-testid={`button-remove-person-${person.id}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Add from existing regulars */}
            {availablePeople.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add from regulars</p>
                  <div className="flex flex-wrap gap-2">
                    {availablePeople.map(person => (
                      <button key={person.id} type="button" onClick={() => addExistingToReceipt(person.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm hover-elevate active-elevate-2" data-testid={`button-add-regular-${person.id}`}>
                        <Plus className="h-3.5 w-3.5" />
                        {person.name}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Add new person */}
            <Card>
              <CardContent className="p-4">
                {!isAddingPerson ? (
                  <Button variant="outline" className="w-full" onClick={openAddPerson} data-testid="button-add-new-person">
                    <Plus className="h-4 w-4 mr-2" /> Add new diner
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">New diner</p>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => { setIsAddingPerson(false); setPendingContact(null); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* From Contacts / Manual tabs */}
                    <div className="flex gap-1 bg-muted rounded-md p-1">
                      {([
                        { id: "contacts" as const, label: "From Contacts", icon: Phone },
                        { id: "manual" as const, label: "Manual", icon: UserPlus },
                      ]).map(({ id, label, icon: Icon }) => (
                        <button key={id} type="button"
                          onClick={() => { setAddMode(id); setPendingContact(null); setNewPersonName(""); setNewPersonPhone(""); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded transition-colors ${addMode === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                          data-testid={`button-add-mode-${id}`}>
                          <Icon className="h-3.5 w-3.5" />{label}
                        </button>
                      ))}
                    </div>

                    {/* Contacts mode */}
                    {addMode === "contacts" && (
                      <div className="space-y-3">
                        {pendingContact ? (
                          <>
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-semibold text-primary">
                                  {getInitials(pendingContact.name)}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{pendingContact.name}</p>
                                {pendingContact.phone && <p className="text-xs text-muted-foreground">{pendingContact.phone}</p>}
                              </div>
                              <Button size="icon" variant="ghost" onClick={() => setPendingContact(null)} className="h-8 w-8" data-testid="button-clear-contact">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <Button className="w-full" disabled={!pendingContact.name || addPersonMutation.isPending}
                              onClick={() => addPersonMutation.mutate({ name: pendingContact.name, phone: pendingContact.phone || undefined })}
                              data-testid="button-confirm-add-contact">
                              {addPersonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Add ${pendingContact.name.split(" ")[0]}`}
                            </Button>
                          </>
                        ) : contactsSupported ? (
                          <Button variant="outline" className="w-full" onClick={handleOpenContacts} data-testid="button-open-contacts">
                            <Phone className="h-4 w-4 mr-2" /> Choose from Contacts
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-3">
                            Contact picking isn't supported in this browser. Switch to Manual.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Manual mode */}
                    {addMode === "manual" && (
                      <div className="space-y-2">
                        <Input placeholder="Name *" value={newPersonName} onChange={e => setNewPersonName(e.target.value)} data-testid="input-new-person-name" />
                        <Input placeholder="Phone (optional)" type="tel" value={newPersonPhone} onChange={e => setNewPersonPhone(e.target.value)} data-testid="input-new-person-phone" />
                        <Button className="w-full" disabled={!newPersonName.trim() || addPersonMutation.isPending}
                          onClick={() => addPersonMutation.mutate({ name: newPersonName.trim(), phone: newPersonPhone.trim() || undefined })}
                          data-testid="button-save-new-person">
                          {addPersonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add diner"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {receiptPeople.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">Add at least one diner to continue.</p>
            )}
          </div>
        )}

        {/* ────────────────────────────── STEP 4: ASSIGN ────────────────────────────── */}
        {step === 4 && (
          <div className="p-4 space-y-4">
            {/* Progress summary */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-lg ${assignedCount === items.length ? "bg-green-50 dark:bg-green-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
              <span className="text-sm font-medium">{assignedCount === items.length ? "All items assigned!" : `${assignedCount} of ${items.length} items assigned`}</span>
              {assignedCount === items.length ? <Check className="h-4 w-4 text-green-600" /> : <span className="text-xs text-amber-600 font-medium">{items.length - assignedCount} remaining</span>}
            </div>

            {peopleWithColors.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Go back and add diners first.</p>
            )}

            {/* Category sections */}
            {hasCategoryData ? (
              <Card>
                <CardContent className="p-0">
                  {(["appetizer", "meal", "drink", "dessert", "other"] as const).map(cat => {
                    const catItems = items.filter(i => i.category === cat);
                    if (catItems.length === 0) return null;
                    const catAssigned = catItems.filter(i => (i.assignedTo as string[])?.length > 0).length;
                    return (
                      <AssignCategorySection key={cat} label={CAT_LABELS[cat]} items={catItems} assigned={catAssigned}
                        peopleWithColors={peopleWithColors} getPersonColor={getPersonColor}
                        onAssignAll={() => openAssignSheet(CAT_LABELS[cat], catItems.map(i => i.id))} />
                    );
                  })}
                  {/* Unassigned/uncategorized */}
                  {items.filter(i => !i.category).length > 0 && (
                    <AssignCategorySection label="Other Items" items={items.filter(i => !i.category)}
                      assigned={items.filter(i => !i.category && (i.assignedTo as string[])?.length > 0).length}
                      peopleWithColors={peopleWithColors} getPersonColor={getPersonColor}
                      onAssignAll={() => openAssignSheet("Other Items", items.filter(i => !i.category).map(i => i.id))} />
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <AssignCategorySection label="All Items" items={items} assigned={assignedCount}
                    peopleWithColors={peopleWithColors} getPersonColor={getPersonColor}
                    onAssignAll={() => openAssignSheet("All Items", items.map(i => i.id))} />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ────────────────────────────── STEP 5: TIP ────────────────────────────── */}
        {step === 5 && (
          <div className="p-4 space-y-4">
            {hasServiceCharge && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Service charge detected</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">A service charge or gratuity may already be included. Double-check before adding a tip on top.</p>
                </div>
              </div>
            )}

            <TipCalculator
              subtotal={sub}
              tipPercentage={tipPct}
              tipAmount={tipAmt}
              onTipPercentageChange={setTipPct}
              onTipAmountChange={setTipAmt}
            />

            {/* Summary */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>${sub.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span>${tax.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tip ({tipPct.toFixed(0)}%)</span><span>${tipAmt.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-2 mt-1"><span>Total</span><span>${(sub + tax + tipAmt).toFixed(2)}</span></div>
              </CardContent>
            </Card>

            {/* Per-person preview */}
            {perPersonTotals.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Each person owes</p>
                  <div className="space-y-2">
                    {perPersonTotals.map(({ person, total, subtotal: psub }) => (
                      <div key={person.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ backgroundColor: person.color }}>
                            {getInitials(person.name)}
                          </div>
                          <span className="text-sm">{person.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-sm">${total.toFixed(2)}</span>
                          {psub > 0 && <span className="text-xs text-muted-foreground ml-1">(items ${psub.toFixed(2)})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ────────────────────────────── STEP 6: PAYER ────────────────────────────── */}
        {step === 6 && (
          <div className="p-4 space-y-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Who paid the bill?</p>
                <div className="space-y-2">
                  {peopleWithColors.map(person => (
                    <button key={person.id} type="button"
                      onClick={() => { setPayerId(person.id); setVenmoInput((person as any).venmoUsername ?? ""); }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${payerId === person.id ? "border-primary bg-primary/5" : "border-border hover-elevate"}`}
                      data-testid={`button-select-payer-${person.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ backgroundColor: person.color }}>
                          {getInitials(person.name)}
                        </div>
                        <span className="font-medium">{person.name}</span>
                      </div>
                      {payerId === person.id && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {payerId && (
              <Card>
                <CardContent className="p-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Venmo username (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                    <Input className="pl-7" placeholder="username" value={venmoInput} onChange={e => setVenmoInput(e.target.value.replace("@", ""))} data-testid="input-venmo-username" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Diners will get a one-tap Venmo link to pay them back.</p>
                </CardContent>
              </Card>
            )}

            {receiptPeople.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">Go back and add diners first.</p>
            )}
          </div>
        )}

        {/* ────────────────────────────── STEP 7: SHARE ────────────────────────────── */}
        {step === 7 && (
          <div className="p-4 space-y-4">
            {/* QR Code */}
            <Card>
              <CardContent className="p-4 flex flex-col items-center gap-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide self-start">Scan to view</p>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="rounded-lg border" data-testid="img-qr-code" />
                ) : (
                  <div className="w-60 h-60 rounded-lg bg-muted flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                {shareUrl && (
                  <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast({ title: "Link copied!" }))}
                    className="text-xs text-primary underline-offset-2 underline break-all text-center" data-testid="button-copy-link">
                    {shareUrl}
                  </button>
                )}
              </CardContent>
            </Card>

            {/* SMS per diner */}
            {receiptPeople.length > 0 && shareUrl && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Send to each diner</p>
                  <div className="space-y-2">
                    {receiptPeople.map((person, i) => {
                      const color = PERSON_COLORS[i % PERSON_COLORS.length];
                      const msg = `Hey ${person.name.split(" ")[0]}! Here's your share of the bill at ${receipt?.restaurantName ?? "the restaurant"}: ${shareUrl}`;
                      const perPersonTotal = perPersonTotals.find(p => p.person.id === person.id);
                      return (
                        <div key={person.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0" style={{ backgroundColor: color }}>
                              {getInitials(person.name)}
                            </div>
                            <div>
                              <span className="text-sm font-medium">{person.name}</span>
                              {perPersonTotal && <span className="ml-2 text-sm text-muted-foreground">${perPersonTotal.total.toFixed(2)}</span>}
                            </div>
                          </div>
                          {(person as any).phone ? (
                            <a href={`sms:${(person as any).phone}?body=${encodeURIComponent(msg)}`}
                              className="flex items-center gap-1 text-sm text-primary font-medium" data-testid={`button-sms-${person.id}`}>
                              <Phone className="h-4 w-4" /> Text
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">No phone</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground text-center">Diners can see their itemized share and pay with Venmo from the link.</p>
          </div>
        )}
      </div>

      {/* ── Bottom Navigation ── */}
      <div className="flex-shrink-0 p-4 border-t bg-card flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)} data-testid="button-wizard-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        {step === 0 && (
          <Button className="flex-1 h-12" onClick={handleScan} disabled={!previewUrl || isScanning} data-testid="button-wizard-scan">
            {isScanning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Scanning…</> : <>Scan Receipt <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        )}
        {step > 0 && step < 7 && (
          <Button className="flex-1 h-12" onClick={handleNext} disabled={nextDisabled || tipSaving} data-testid="button-wizard-next">
            {tipSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        )}
        {step === 7 && (
          <Button className="flex-1 h-12" onClick={handleNext} data-testid="button-wizard-done">
            <Check className="h-4 w-4 mr-2" /> Done — View Receipt
          </Button>
        )}
      </div>

      {/* ── Assign People Sheet ── */}
      <BottomSheet open={!!assignSheet} onClose={() => setAssignSheet(null)} title={`Assign ${assignSheet?.label ?? ""}`}>
        <div className="space-y-4 pb-2">
          <p className="text-sm text-muted-foreground">{assignSheet?.itemIds.length} item{assignSheet?.itemIds.length !== 1 ? "s" : ""} will be assigned to the selected people.</p>
          <div className="flex flex-wrap gap-2">
            {peopleWithColors.length > 1 && (
              <button type="button" onClick={toggleEveryone} data-testid="button-select-everyone"
                className={`flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-medium border transition-colors ${everyoneSelected ? "bg-foreground text-background border-foreground" : "bg-background text-foreground border-border hover-elevate"}`}>
                <Users className="h-3.5 w-3.5" /> Everyone
              </button>
            )}
            {peopleWithColors.map(person => (
              <PersonChip key={person.id} name={person.name} initials={getInitials(person.name)} color={person.color}
                selected={assignPeople.includes(person.id)} onSelect={() => toggleAssignPerson(person.id)} />
            ))}
          </div>
          <Button className="w-full h-12" disabled={assignPeople.length === 0 || isAssigning} onClick={confirmAssign} data-testid="button-confirm-assign">
            {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : `Assign to ${assignPeople.length === peopleWithColors.length && assignPeople.length > 0 ? "everyone" : `${assignPeople.length} person${assignPeople.length !== 1 ? "s" : ""}`}`}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ReviewItemsStep({ receiptId, items, receipt, subtotalDiff }: {
  receiptId: string; items: ReceiptItem[]; receipt: Receipt | undefined; subtotalDiff: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("1");
  const [editPrice, setEditPrice] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addPrice, setAddPrice] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
    queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
  };

  const startEdit = (item: ReceiptItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQty(String(item.quantity));
    setEditPrice(parseFloat(item.price).toFixed(2));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await apiRequest(`/api/items/${editingId}`, "PATCH", {
        name: editName.trim(), quantity: parseInt(editQty) || 1, price: parseFloat(editPrice).toFixed(2),
      });
      invalidate();
      setEditingId(null);
    } catch { toast({ title: "Failed to update item", variant: "destructive" }); }
  };

  const deleteItem = async (id: string) => {
    try {
      await apiRequest(`/api/items/${id}`, "DELETE");
      invalidate();
    } catch { toast({ title: "Failed to delete item", variant: "destructive" }); }
  };

  const addItem = async () => {
    if (!addName.trim() || !addPrice) return;
    try {
      await apiRequest(`/api/receipts/${receiptId}/items`, "POST", {
        name: addName.trim(), quantity: parseInt(addQty) || 1, price: parseFloat(addPrice).toFixed(2),
      });
      invalidate();
      setAddName(""); setAddQty("1"); setAddPrice(""); setShowAdd(false);
    } catch { toast({ title: "Failed to add item", variant: "destructive" }); }
  };

  const sub = parseFloat(receipt?.subtotal ?? "0") || 0;
  const itemsTotal = items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);

  return (
    <div className="p-4 space-y-4">
      {subtotalDiff > 0.50 && sub > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-300">
            <p className="font-semibold text-amber-800 dark:text-amber-200 mb-0.5">Items don't add up</p>
            Items total <strong>${itemsTotal.toFixed(2)}</strong> but receipt shows <strong>${sub.toFixed(2)}</strong> — check for missing items.
          </div>
        </div>
      )}

      {receipt?.restaurantName && (
        <div className="text-center">
          <p className="font-semibold text-lg">{receipt.restaurantName}</p>
        </div>
      )}

      <Card>
        <CardContent className="p-0 divide-y">
          {items.length === 0 && <p className="p-4 text-muted-foreground text-sm text-center">No items — add them below.</p>}
          {items.map(item => (
            <div key={item.id} className="px-4 py-3">
              {editingId === item.id ? (
                <div className="space-y-2">
                  <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Item name" className="text-sm" data-testid={`input-edit-name-${item.id}`} />
                  <div className="flex gap-2">
                    <div className="w-20">
                      <label className="text-[10px] text-muted-foreground">Qty</label>
                      <Input type="number" min="1" value={editQty} onChange={e => setEditQty(e.target.value)} className="text-sm" data-testid={`input-edit-qty-${item.id}`} />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground">Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <Input type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="pl-6 text-sm" data-testid={`input-edit-price-${item.id}`} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button size="sm" className="flex-1" onClick={saveEdit} data-testid={`button-save-edit-${item.id}`}>Save</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity > 1 ? `${item.quantity}×` : ""} ${parseFloat(item.price).toFixed(2)}{item.quantity > 1 ? ` = $${(parseFloat(item.price) * item.quantity).toFixed(2)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(item)} className="h-8 w-8" data-testid={`button-edit-item-${item.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteItem(item.id)} className="h-8 w-8 text-destructive" data-testid={`button-delete-item-${item.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add item */}
      {showAdd ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Add item</p>
            <Input placeholder="Item name" value={addName} onChange={e => setAddName(e.target.value)} data-testid="input-add-name" />
            <div className="flex gap-2">
              <div className="w-20">
                <label className="text-[10px] text-muted-foreground">Qty</label>
                <Input type="number" min="1" value={addQty} onChange={e => setAddQty(e.target.value)} data-testid="input-add-qty" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input type="number" step="0.01" value={addPrice} onChange={e => setAddPrice(e.target.value)} className="pl-6" data-testid="input-add-price" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setAddName(""); setAddQty("1"); setAddPrice(""); }}>Cancel</Button>
              <Button className="flex-1" disabled={!addName.trim() || !addPrice} onClick={addItem} data-testid="button-confirm-add-item">Add</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)} data-testid="button-add-item">
          <Plus className="h-4 w-4 mr-2" /> Add missing item
        </Button>
      )}

      {/* Totals footer */}
      <Card>
        <CardContent className="p-4 space-y-1.5">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Items total</span><span>${itemsTotal.toFixed(2)}</span></div>
          {sub > 0 && <div className={`flex justify-between text-sm ${subtotalDiff > 0.50 ? "text-amber-600" : "text-muted-foreground"}`}><span>Receipt subtotal</span><span>${sub.toFixed(2)}</span></div>}
          {sub > 0 && subtotalDiff <= 0.50 && <div className="flex items-center gap-1 text-xs text-green-600"><Check className="h-3 w-3" /> Totals match</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryItemRow({ item, receiptId, onUpdated }: { item: ReceiptItem; receiptId: string; onUpdated: () => void }) {
  const [cat, setCat] = useState<string | null>(item.category ?? null);
  const categories: { value: string; label: string }[] = [
    { value: "appetizer", label: "App" },
    { value: "meal", label: "Meal" },
    { value: "drink", label: "Drink" },
    { value: "dessert", label: "Dessert" },
    { value: "other", label: "Other" },
  ];

  const save = async (newCat: string | null) => {
    setCat(newCat);
    try {
      await apiRequest(`/api/items/${item.id}`, "PATCH", { category: newCat });
      onUpdated();
    } catch { /* revert */ setCat(item.category ?? null); }
  };

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">${parseFloat(item.price).toFixed(2)}</p>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {categories.map(c => (
          <button key={c.value} type="button"
            onClick={() => save(cat === c.value ? null : c.value)}
            data-testid={`button-category-${c.value}-${item.id}`}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${cat === c.value ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover-elevate"}`}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AssignCategorySection({ label, items, assigned, peopleWithColors, getPersonColor, onAssignAll }: {
  label: string;
  items: ReceiptItem[];
  assigned: number;
  peopleWithColors: { id: string; name: string; color: string }[];
  getPersonColor: (pid: string) => string;
  onAssignAll: () => void;
}) {
  const allAssigned = assigned === items.length;
  const someAssigned = assigned > 0 && !allAssigned;

  return (
    <div>
      <button type="button" onClick={onAssignAll}
        className="w-full flex items-center gap-2 px-4 py-2 bg-muted/50 border-b hover-elevate active-elevate-2"
        data-testid={`button-assign-section-${label.toLowerCase().replace(" ", "-")}`}>
        {allAssigned
          ? <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
          : someAssigned
            ? <MinusCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        }
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex-1 text-left">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {assigned > 0 ? `${assigned}/${items.length}` : items.length}
        </span>
      </button>
      <div className="divide-y">
        {items.map(item => {
          const assigned2 = (item.assignedTo as string[]) || [];
          return (
            <div key={item.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">${parseFloat(item.price).toFixed(2)}</p>
              </div>
              <div className="flex -space-x-1 flex-shrink-0">
                {assigned2.length === 0 && <span className="text-xs text-muted-foreground">unassigned</span>}
                {assigned2.slice(0, 4).map(pid => {
                  const person = peopleWithColors.find(p => p.id === pid);
                  if (!person) return null;
                  return (
                    <div key={pid} title={person.name}
                      className="h-6 w-6 rounded-full border-2 border-background flex items-center justify-center text-white text-[9px] font-bold"
                      style={{ backgroundColor: person.color }}>
                      {getInitials(person.name)}
                    </div>
                  );
                })}
                {assigned2.length > 4 && <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[9px] font-bold">+{assigned2.length - 4}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
