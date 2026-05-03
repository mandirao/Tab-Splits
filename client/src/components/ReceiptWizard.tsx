import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BottomSheet from "@/components/BottomSheet";
import PersonChip from "@/components/PersonChip";
import TipCalculator from "@/components/TipCalculator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Upload, Loader2, RotateCw, RotateCcw, Check, ArrowLeft, ArrowRight,
  Sparkles, Users, Plus, X, CheckCircle2, Circle, AlertTriangle,
  Pencil, Trash2, Phone, MinusCircle, UserPlus, Utensils, Layers, Shuffle, ImageIcon,
  Tag, Salad, UtensilsCrossed, GlassWater, Cake, Share2, Copy, MessageSquare,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import QRCodeLib from "qrcode";
import type { Receipt, ReceiptItem, Person } from "@shared/schema";
import { CAT_LABELS, CAT_LABELS_SINGULAR, getInitials, PERSON_COLORS } from "@/lib/categories";
import AssignPersonSheetBody from "@/components/AssignPersonSheetBody";

// ─── Constants ────────────────────────────────────────────────────────────────


const STEP_LABELS = ["Scan", "Items", "Format", "Diners", "Assign", "Tip", "Review", "Paid by", "Share"];
const STEP_SUBTITLES = [
  "Take or upload a photo of your receipt",
  "Verify items and review categories",
  "How did your table split the bill?",
  "Who's splitting the bill?",
  "Match items to people",
  "Confirm the tip amount",
  "Check each person's bill before sharing",
  "Who covered the bill?",
  "Send the bill to your diners",
];

type DiningFormat = "family" | "courses" | "mixed";

const SERVICE_CHARGE_TERMS = ["gratuity", "service charge", "service fee", "auto-grat", "auto grat", "autogratuity"];

// ─── Main Wizard Component ────────────────────────────────────────────────────

interface ReceiptWizardProps {
  open: boolean;
  onClose: (receiptId?: string, completed?: boolean) => void;
  initialReceiptId?: string;
}

export default function ReceiptWizard({ open, onClose, initialReceiptId }: ReceiptWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [diningFormat, setDiningFormat] = useState<DiningFormat | null>(null);
  const autoAssignApplied = useRef(false);
  const hasInitializedFromReceipt = useRef(false);

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
  const [assignedQuantities, setAssignedQuantities] = useState<Record<string, number>>({});
  const [isAssigning, setIsAssigning] = useState(false);
  const [drawerCatOverrides, setDrawerCatOverrides] = useState<Record<string, string>>({});
  const [drawerQtyOverrides, setDrawerQtyOverrides] = useState<Record<string, number>>({});
  // Sequential auto-advance
  const [autoAdvanceMode, setAutoAdvanceMode] = useState(true);
  const [autoAssignDone, setAutoAssignDone] = useState(false);
  const [seqProcessed, setSeqProcessed] = useState<Set<string>>(new Set());

  // Assign step — full item edit sheet
  const [assignEditSheet, setAssignEditSheet] = useState<{ id: string; name: string; quantity: number; price: string; category: string | null } | null>(null);

  // Step 6 review
  const [reviewPersonIdx, setReviewPersonIdx] = useState(0);
  const [reviewEditItem, setReviewEditItem] = useState<ReceiptItem | null>(null);
  const [reviewEditName, setReviewEditName] = useState("");
  const [reviewEditPrice, setReviewEditPrice] = useState("");

  // Step 5 tip
  const [tipPct, setTipPct] = useState(20);
  const [tipAmt, setTipAmt] = useState(0);
  const [tipSaving, setTipSaving] = useState(false);

  // Step 7 payer
  const [payerId, setPayerId] = useState<string | null>(null);
  const [venmoInput, setVenmoInput] = useState("");

  // Step 8 share
  const [wizardShareToken, setWizardShareToken] = useState<string | null>(null);
  const [wizardQrDataUrl, setWizardQrDataUrl] = useState<string>("");
  const [wizardUrlCopied, setWizardUrlCopied] = useState(false);

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
      setPayerId(null);
      setVenmoInput("");
      setWizardShareToken(null);
      setWizardQrDataUrl("");
      setWizardUrlCopied(false);
      setDiningFormat(null);
      autoAssignApplied.current = false;
      hasInitializedFromReceipt.current = false;
      setAutoAssignDone(false);
      setAutoAdvanceMode(true);
      setSeqProcessed(new Set());
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

  // Populate diningFormat and paidBy from saved receipt data (once per open session)
  useEffect(() => {
    if (!open || !receipt || hasInitializedFromReceipt.current) return;
    hasInitializedFromReceipt.current = true;
    if (receipt.diningFormat) {
      setDiningFormat(receipt.diningFormat as DiningFormat);
    }
    if (receipt.paidById) {
      setPayerId(receipt.paidById);
      const payer = receiptPeople.find(p => p.id === receipt.paidById)
        || allPeople.find(p => p.id === receipt.paidById);
      if (payer?.venmoUsername) setVenmoInput(payer.venmoUsername);
    }
  }, [open, receipt, receiptPeople, allPeople]);

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
  const handleCategorize = async (silent = false) => {
    if (!receiptId) return;
    setIsCategorizing(true);
    try {
      await apiRequest(`/api/receipts/${receiptId}/categorize`, "POST", {});
      await refetchItems();
      if (!silent) toast({ title: "Items categorized!" });
    } catch (err: any) {
      if (!silent) toast({ title: "Categorization failed", description: err.message, variant: "destructive" });
    } finally {
      setIsCategorizing(false);
    }
  };

  // Auto-categorize silently when the user lands on the Items step (step 1)
  useEffect(() => {
    const alreadyCategorized = items.some(i => i.category);
    if (step === 1 && receiptId && items.length > 0 && !alreadyCategorized && !isCategorizing) {
      handleCategorize(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, receiptId, items.length]);

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
  const openAssignSheet = (
    label: string,
    itemIds: string[],
    currentAssignment?: string[],
    currentQuantities?: Record<string, number>,
  ) => {
    const qtys = currentQuantities ?? {};
    const hasSaved = (currentAssignment?.length ?? 0) > 1 &&
      (currentAssignment?.some(pid => (qtys[pid] ?? 0) > 0) ?? false);
    setAssignPeople(currentAssignment ?? []);
    setAssignedQuantities(qtys);
    setDrawerCatOverrides({});
    setDrawerQtyOverrides({});
    setAssignSheet({ label, itemIds });
  };

  const changeItemQuantity = async (itemId: string, qty: number) => {
    if (qty < 1) return;
    setDrawerQtyOverrides(prev => ({ ...prev, [itemId]: qty }));
    try {
      await apiRequest(`/api/items/${itemId}`, "PATCH", { quantity: qty });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
    } catch {
      setDrawerQtyOverrides(prev => { const n = { ...prev }; delete n[itemId]; return n; });
    }
  };

  const changeItemCategory = async (itemId: string, cat: string) => {
    setDrawerCatOverrides(prev => ({ ...prev, [itemId]: cat }));
    try {
      await apiRequest(`/api/items/${itemId}`, "PATCH", { category: cat === "__none__" ? null : cat });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
    } catch {
      setDrawerCatOverrides(prev => { const n = { ...prev }; delete n[itemId]; return n; });
    }
  };

  const saveAssignEdit = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; quantity: number; price: string; category: string | null } }) =>
      apiRequest(`/api/items/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
      setAssignEditSheet(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to save changes", description: error.message, variant: "destructive" });
    },
  });

  const confirmAssign = async () => {
    if (!assignSheet || assignPeople.length === 0) return;
    setIsAssigning(true);
    try {
      const qtys = assignedQuantities;
      await Promise.all(
        assignSheet.itemIds.map(id =>
          apiRequest(`/api/items/${id}`, "PATCH", { assignedTo: assignPeople, assignedQuantities: qtys })
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

  const confirmAssignAndNext = async () => {
    if (!assignSheet || assignPeople.length === 0) return;
    // Mark as processed immediately so auto-advance skips it before query refetches
    setSeqProcessed(prev => new Set([...prev, ...assignSheet.itemIds]));
    await confirmAssign();
    // auto-advance effect opens the next item once assignSheet becomes null
  };

  const skipAndNext = () => {
    if (!assignSheet) return;
    setSeqProcessed(prev => new Set([...prev, ...assignSheet.itemIds]));
    setAssignSheet(null);
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

  // ─── Step 8: Share ────────────────────────────────────────────────────────
  const generateWizardShareMutation = useMutation({
    mutationFn: () => apiRequest(`/api/receipts/${receiptId}/generate-share-token`, "POST", {}),
    onSuccess: async (data: { shareToken: string }) => {
      setWizardShareToken(data.shareToken);
      const shareUrl = `${window.location.origin}/share/${data.shareToken}`;
      try {
        const qrDataUrl = await QRCodeLib.toDataURL(shareUrl, { width: 192 });
        setWizardQrDataUrl(qrDataUrl);
      } catch { /* QR optional */ }
    },
    onError: (error: any) => {
      toast({ title: "Failed to generate share link", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (step !== 8 || !receiptId || wizardShareToken || generateWizardShareMutation.isPending) return;
    generateWizardShareMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, receiptId]);

  const handleWizardSMS = (person: { name: string; phone: string }) => {
    if (!wizardShareToken) return;
    const shareUrl = `${window.location.origin}/share/${wizardShareToken}`;
    const msg = `Check out our bill at ${receipt?.restaurantName || "the restaurant"}! ${shareUrl}`;
    window.location.href = `sms:${person.phone}?body=${encodeURIComponent(msg)}`;
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

  // ─── Auto-assign based on dining format ──────────────────────────────────
  useEffect(() => {
    if (step !== 4 || !receiptId || !diningFormat || diningFormat === "mixed") return;
    if (autoAssignApplied.current) return;
    if (items.length === 0 || peopleWithColors.length === 0) return;
    autoAssignApplied.current = true;

    const allIds = peopleWithColors.map(p => p.id);
    const toAssign: ReceiptItem[] = [];

    if (diningFormat === "family") {
      // Assign everyone to all non-drink items
      toAssign.push(...items.filter(i => i.category !== "drink"));
    } else if (diningFormat === "courses") {
      // Assign everyone to appetizers + desserts + other; meals and drinks stay individual
      toAssign.push(...items.filter(i => i.category === "appetizer" || i.category === "dessert" || i.category === "other"));
    }

    if (toAssign.length === 0) {
      setAutoAssignDone(true);
      return;
    }

    const run = async () => {
      try {
        await Promise.all(
          toAssign.map(item =>
            apiRequest(`/api/items/${item.id}`, "PATCH", { assignedTo: allIds, assignedQuantities: {} })
          )
        );
        await queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
        const label = diningFormat === "family" ? "food items assigned to everyone" : "shared items assigned to everyone";
        toast({ title: `Auto-assigned: ${toAssign.length} ${label}` });
      } catch { /* silent — user can still assign manually */ }
      finally { setAutoAssignDone(true); }
    };
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, receiptId, diningFormat, items.length, peopleWithColors.length]);

  // ─── Sequential item order (same category order as the Assign display) ──
  const CAT_SEQ_ORDER = ["appetizer", "meal", "dessert", "other", "drink"] as const;
  const getSeqItems = (itemList: ReceiptItem[], processed: Set<string>) => [
    ...CAT_SEQ_ORDER.flatMap(cat => itemList.filter(i => i.category === cat)),
    ...itemList.filter(i => !i.category),
  ].filter(i => !(i.assignedTo as string[])?.length && !processed.has(i.id));

  // ─── Auto-advance: open the next unassigned item when no sheet is open ───
  useEffect(() => {
    if (step !== 4 || !autoAdvanceMode || assignSheet) return;
    // Wait until auto-assign has finished (or not needed for mixed)
    if (!autoAssignDone && diningFormat !== "mixed") return;
    if (items.length === 0 || peopleWithColors.length === 0) return;

    const seq = getSeqItems(items, seqProcessed);
    if (seq.length === 0) return;
    const next = seq[0];
    openAssignSheet(next.name, [next.id],
      (next.assignedTo as string[]) || [],
      (next.assignedQuantities as Record<string, number>) || {},
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, autoAdvanceMode, autoAssignDone, diningFormat, items, assignSheet, seqProcessed, peopleWithColors.length]);

  // ─── Navigation ───────────────────────────────────────────────────────────
  const handleNext = async () => {
    if (step === 5) await saveTip();
    if (step === 7) await savePayer();
    if (step === 8) { onClose(receiptId ?? undefined, true); return; }
    setStep(s => s + 1);
  };

  const nextDisabled = (() => {
    if (step === 0) return !previewUrl || isScanning;
    if (step === 2) return !diningFormat;
    return false;
  })();

  if (!open) return null;

  // ─── Derived data for steps ───────────────────────────────────────────────
  const sub = parseFloat(receipt?.subtotal ?? "0") || 0;
  const tax = parseFloat(receipt?.tax ?? "0") || 0;
  // OCR often stores line totals as the price (not unit prices), so we check both
  // sum(price × qty) and sum(price) and use whichever is closer to the receipt subtotal.
  const itemsSubtotalByUnit = items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);
  const itemsSubtotalByLine = items.reduce((s, i) => s + parseFloat(i.price), 0);
  const subtotalDiff = sub > 0
    ? Math.min(Math.abs(itemsSubtotalByUnit - sub), Math.abs(itemsSubtotalByLine - sub))
    : 0;
  const hasCategoryData = items.some(i => i.category);
  const hasServiceCharge = items.some(i =>
    SERVICE_CHARGE_TERMS.some(term => i.name.toLowerCase().includes(term))
  );
  const assignedCount = items.filter(i => (i.assignedTo as string[])?.length > 0).length;

  // Determine whether OCR stored line totals or unit prices in the price field
  // (same logic used for the subtotal warning banner)
  const usePriceAsLineTotal = sub > 0
    ? Math.abs(itemsSubtotalByLine - sub) < Math.abs(itemsSubtotalByUnit - sub)
    : false;
  const effectiveItemCost = (item: ReceiptItem) =>
    usePriceAsLineTotal ? parseFloat(item.price) : parseFloat(item.price) * item.quantity;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="wizard-overlay">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 pt-safe-top pt-4 pb-2 border-b bg-card">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Step {step + 1} of 9</p>
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
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${((step + 1) / 9) * 100}%` }} />
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto scrollbar-hide pb-0.5">
          {STEP_LABELS.map((label, i) => (
            i < step ? (
              <button
                key={label}
                onClick={() => setStep(i)}
                className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium bg-primary/20 text-primary hover:bg-primary/35 transition-colors"
                data-testid={`wizard-step-pill-${i}`}
              >
                ✓ {label}
              </button>
            ) : (
              <span
                key={label}
                className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                data-testid={`wizard-step-pill-${i}`}
              >
                {label}
              </span>
            )
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

        {/* ────────────────────────────── STEP 1: ITEMS + CATEGORIES ────────────────────────────── */}
        {step === 1 && (
          <ReviewItemsStep
            receiptId={receiptId!}
            items={items}
            receipt={receipt}
            subtotalDiff={subtotalDiff}
            fromExistingReceipt={!!initialReceiptId}
            onEditItem={(item) => setAssignEditSheet({ id: item.id, name: item.name, quantity: item.quantity ?? 1, price: item.price, category: item.category ?? null })}
            isCategorizing={isCategorizing}
          />
        )}

        {/* ────────────────────────────── STEP 2: FORMAT ────────────────────────────── */}
        {step === 2 && (() => {
          const formats = [
            {
              id: "family" as DiningFormat,
              icon: Utensils,
              label: "Family Style",
              lines: ["All food split equally.", "People pay for their own drinks."],
            },
            {
              id: "courses" as DiningFormat,
              icon: Layers,
              label: "Courses",
              lines: ["Apps & desserts split equally.", "People pay for their own entree and drinks."],
            },
            {
              id: "mixed" as DiningFormat,
              icon: Shuffle,
              label: "Mixed Bag",
              lines: ["Full manual control."],
            },
          ];
          return (
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3 items-stretch">
                {formats.map(fmt => {
                  const Icon = fmt.icon;
                  const selected = diningFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => {
                        setDiningFormat(fmt.id);
                        if (receiptId) {
                          apiRequest(`/api/receipts/${receiptId}`, "PATCH", { diningFormat: fmt.id });
                        }
                      }}
                      className={`relative rounded-lg border-2 flex flex-col items-center p-4 text-center transition-colors min-h-[160px] ${selected ? "border-primary bg-primary/5" : "border-border hover-elevate"}`}
                      data-testid={`button-format-${fmt.id}`}
                    >
                      {selected && (
                        <span className="absolute top-2 right-2">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        </span>
                      )}
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-2.5 ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className={`text-sm font-semibold leading-tight mb-2 ${selected ? "text-primary" : ""}`}>{fmt.label}</p>
                      {fmt.lines.map((line, i) => (
                        <p key={i} className="text-xs leading-snug text-muted-foreground">{line}</p>
                      ))}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
                  {(["appetizer", "meal", "dessert", "other", "drink"] as const).map(cat => {
                    const catItems = items.filter(i => i.category === cat);
                    if (catItems.length === 0) return null;
                    const catAssigned = catItems.filter(i => (i.assignedTo as string[])?.length > 0).length;
                    return (
                      <AssignCategorySection key={cat} label={CAT_LABELS[cat]} items={catItems} assigned={catAssigned}
                        peopleWithColors={peopleWithColors} getPersonColor={getPersonColor}
                        onAssignAll={() => openAssignSheet(CAT_LABELS[cat], catItems.map(i => i.id))}
                        onAssignItem={(itemId, itemName) => {
                          const item = items.find(i => i.id === itemId);
                          setAutoAdvanceMode(true);
                          setSeqProcessed(new Set());
                          openAssignSheet(itemName, [itemId],
                            (item?.assignedTo as string[]) || [],
                            (item?.assignedQuantities as Record<string, number>) || {},
                          );
                        }}
                        onEditItem={(item) => setAssignEditSheet({ id: item.id, name: item.name, quantity: item.quantity ?? 1, price: item.price, category: item.category ?? null })} />
                    );
                  })}
                  {/* Unassigned/uncategorized */}
                  {items.filter(i => !i.category).length > 0 && (
                    <AssignCategorySection label="Other Items" items={items.filter(i => !i.category)}
                      assigned={items.filter(i => !i.category && (i.assignedTo as string[])?.length > 0).length}
                      peopleWithColors={peopleWithColors} getPersonColor={getPersonColor}
                      onAssignAll={() => openAssignSheet("Other Items", items.filter(i => !i.category).map(i => i.id))}
                      onAssignItem={(itemId, itemName) => {
                        const item = items.find(i => i.id === itemId);
                        setAutoAdvanceMode(true);
                        setSeqProcessed(new Set());
                        openAssignSheet(itemName, [itemId],
                          (item?.assignedTo as string[]) || [],
                          (item?.assignedQuantities as Record<string, number>) || {},
                        );
                      }}
                      onEditItem={(item) => setAssignEditSheet({ id: item.id, name: item.name, quantity: item.quantity ?? 1, price: item.price, category: item.category ?? null })} />
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <AssignCategorySection label="All Items" items={items} assigned={assignedCount}
                    peopleWithColors={peopleWithColors} getPersonColor={getPersonColor}
                    onAssignAll={() => openAssignSheet("All Items", items.map(i => i.id))}
                    onAssignItem={(itemId, itemName) => {
                      const item = items.find(i => i.id === itemId);
                      setAutoAdvanceMode(true);
                      setSeqProcessed(new Set());
                      openAssignSheet(itemName, [itemId],
                        (item?.assignedTo as string[]) || [],
                        (item?.assignedQuantities as Record<string, number>) || {},
                      );
                    }}
                    onEditItem={(item) => setAssignEditSheet({ id: item.id, name: item.name, quantity: item.quantity ?? 1, price: item.price, category: item.category ?? null })} />
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

          </div>
        )}

        {/* ────────────────────────────── STEP 6: REVIEW ────────────────────────────── */}
        {step === 6 && (() => {
          const tipFromReceipt = parseFloat(receipt?.tip ?? "0") || tipAmt;
          const taxFromReceipt = parseFloat(receipt?.tax ?? "0") || 0;

          const getPersonItemShare = (item: ReceiptItem, personId: string): number => {
            const assignedTo = (item.assignedTo as string[]) || [];
            if (!assignedTo.includes(personId)) return 0;
            const cost = effectiveItemCost(item);
            const quantities = (item.assignedQuantities as Record<string, number>) || {};
            const hasQuantities = assignedTo.some(pid => (quantities[pid] ?? 0) > 0);
            if (hasQuantities) {
              const totalWeight = assignedTo.reduce((s, pid) => s + (quantities[pid] ?? 1), 0);
              return totalWeight > 0 ? cost * (quantities[personId] ?? 1) / totalWeight : cost / assignedTo.length;
            }
            return cost / assignedTo.length;
          };

          const getPersonSubtotal = (personId: string) =>
            items.reduce((s, item) => s + getPersonItemShare(item, personId), 0);

          const totalAssignedSubtotal = peopleWithColors.reduce(
            (s, p) => s + getPersonSubtotal(p.id), 0
          );

          const unassignedItems = items.filter(i => !(i.assignedTo as string[])?.length);

          const currentPerson = peopleWithColors[reviewPersonIdx] ?? peopleWithColors[0];

          if (!currentPerson) {
            return (
              <div className="p-4 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Users className="h-8 w-8" />
                <p className="text-sm">Go back and add diners first.</p>
              </div>
            );
          }

          const personSubtotal = getPersonSubtotal(currentPerson.id);
          const taxTip = taxFromReceipt + tipFromReceipt;
          const personTaxTip = totalAssignedSubtotal > 0
            ? (personSubtotal / totalAssignedSubtotal) * taxTip
            : 0;
          const personTotal = personSubtotal + personTaxTip;
          const personItems = items.filter(i =>
            (i.assignedTo as string[])?.includes(currentPerson.id)
          );

          return (
            <div className="p-4 space-y-4">
              {unassignedItems.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    <strong>{unassignedItems.length} item{unassignedItems.length > 1 ? "s" : ""}</strong> not yet assigned — {unassignedItems.map(i => i.name).join(", ")}
                  </p>
                </div>
              )}

              {/* Person pill tab bar */}
              <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 min-w-max pb-0.5">
                  {peopleWithColors.map((p, i) => {
                    const active = i === reviewPersonIdx;
                    return (
                      <button key={p.id} type="button" onClick={() => setReviewPersonIdx(i)}
                        className="flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-medium border transition-colors flex-shrink-0 whitespace-nowrap"
                        style={{
                          backgroundColor: active ? p.color : undefined,
                          borderColor: p.color,
                          color: active ? "white" : undefined,
                        }}
                        data-testid={`button-review-tab-${i}`}>
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0"
                          style={{ backgroundColor: p.color }}>
                          {getInitials(p.name)}
                        </div>
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Person bill card */}
              <Card>
                <CardContent className="p-4">
                  {personItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No items assigned yet</p>
                  ) : (
                    <div className="space-y-1">
                      {personItems.map(item => {
                        const share = getPersonItemShare(item, currentPerson.id);
                        const assignedTo = (item.assignedTo as string[]) || [];
                        const quantities = (item.assignedQuantities as Record<string, number>) || {};
                        const hasQuantities = assignedTo.some(pid => (quantities[pid] ?? 0) > 0);

                        // Compute the fraction label (e.g. "1/4" or "2/5")
                        let fractionLabel: string | null = null;
                        if (assignedTo.length > 1) {
                          if (hasQuantities) {
                            const totalWeight = assignedTo.reduce((s, pid) => s + (quantities[pid] ?? 1), 0);
                            const myWeight = quantities[currentPerson.id] ?? 1;
                            // Try to express as a simple fraction
                            const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
                            const g = gcd(myWeight, totalWeight);
                            fractionLabel = `${myWeight / g}/${totalWeight / g}`;
                          } else {
                            fractionLabel = `1/${assignedTo.length}`;
                          }
                        }

                        return (
                          <div key={item.id} className="flex items-center divide-x">
                            {/* Main: name + price below + bubbles */}
                            <div className="flex-1 flex items-center gap-3 py-2 min-w-0">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {fractionLabel && (
                                    <span className="text-xs text-muted-foreground font-medium tabular-nums flex-shrink-0">{fractionLabel}</span>
                                  )}
                                  <p className="text-sm font-medium leading-tight truncate">{item.name}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">${share.toFixed(2)}</p>
                              </div>
                              {/* Bubbles — tap to reassign */}
                              <button
                                type="button"
                                onClick={() => openAssignSheet(item.name, [item.id], assignedTo, hasQuantities ? quantities : undefined)}
                                className="flex -space-x-1.5 flex-shrink-0 hover-elevate active-elevate-2 rounded-full p-0.5"
                                data-testid={`button-review-item-${item.id}`}
                              >
                                {assignedTo.length === 0 && (
                                  <div className="w-7 h-7 rounded-full ring-2 ring-border bg-muted/50 flex items-center justify-center">
                                    <Users className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                )}
                                {assignedTo.slice(0, 3).map(pid => {
                                  const person = peopleWithColors.find(p => p.id === pid);
                                  if (!person) return null;
                                  return (
                                    <div key={pid}
                                      className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center ring-2 ring-background"
                                      style={{ backgroundColor: person.color }}>
                                      {getInitials(person.name)}
                                    </div>
                                  );
                                })}
                                {assignedTo.length > 3 && (
                                  <div className="w-7 h-7 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-xs font-semibold">
                                    +{assignedTo.length - 3}
                                  </div>
                                )}
                              </button>
                            </div>
                            {/* Pencil column */}
                            <button
                              type="button"
                              onClick={() => setAssignEditSheet({ id: item.id, name: item.name, quantity: item.quantity ?? 1, price: item.price, category: item.category ?? null })}
                              className="px-3 py-3 flex items-center justify-center self-stretch text-muted-foreground hover-elevate active-elevate-2 flex-shrink-0"
                              data-testid={`button-review-edit-${item.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t space-y-1.5">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal</span>
                      <span>${personSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Tax + tip share</span>
                      <span>${personTaxTip.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-base pt-1.5 border-t">
                      <span>Total</span>
                      <span>${personTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          );
        })()}

        {/* ────────────────────────────── STEP 8: SHARE ────────────────────────────── */}
        {step === 8 && (
          <div className="p-4 space-y-4">
            {generateWizardShareMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Generating share link…</p>
              </div>
            ) : wizardShareToken ? (
              <>
                {wizardQrDataUrl && (
                  <Card>
                    <CardContent className="p-4 flex flex-col items-center gap-3">
                      <div className="p-3 bg-white rounded-xl">
                        <img src={wizardQrDataUrl} alt="QR Code" className="w-48 h-48" data-testid="img-wizard-qr" />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">Diners can scan this to view their share of the bill</p>
                    </CardContent>
                  </Card>
                )}

                <Button variant="outline" className="w-full" onClick={async () => {
                  const shareUrl = `${window.location.origin}/share/${wizardShareToken}`;
                  await navigator.clipboard.writeText(shareUrl);
                  setWizardUrlCopied(true);
                  toast({ title: "Link copied!" });
                  setTimeout(() => setWizardUrlCopied(false), 2000);
                }} data-testid="button-wizard-copy-link">
                  {wizardUrlCopied
                    ? <><Check className="h-4 w-4 mr-2 text-green-500" />Copied!</>
                    : <><Copy className="h-4 w-4 mr-2" />Copy Link</>}
                </Button>

                {receiptPeople.length > 0 && (
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Send via Text</p>
                      <div className="space-y-2">
                        {receiptPeople.map(person => {
                          const hasPhone = !!(person as any).phone;
                          const color = peopleWithColors.find(pw => pw.id === person.id)?.color ?? "#888";
                          return (
                            <Button key={person.id} variant="outline" className="w-full justify-between"
                              disabled={!hasPhone}
                              onClick={() => hasPhone && handleWizardSMS({ name: person.name, phone: (person as any).phone })}
                              data-testid={`button-wizard-sms-${person.id}`}>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full text-white text-xs font-semibold flex items-center justify-center"
                                  style={{ backgroundColor: color }}>
                                  {getInitials(person.name)}
                                </div>
                                <span>{person.name}</span>
                              </div>
                              {hasPhone
                                ? <MessageSquare className="h-4 w-4" />
                                : <span className="text-xs text-muted-foreground">Missing phone number</span>}
                            </Button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <p className="text-sm text-muted-foreground">Could not generate share link.</p>
                <Button variant="outline" onClick={() => generateWizardShareMutation.mutate()}>Try again</Button>
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────── STEP 7: PAYER ────────────────────────────── */}
        {step === 7 && (
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
        {step > 0 && step < 8 && (
          <Button className="flex-1 h-12" onClick={handleNext} disabled={nextDisabled || tipSaving} data-testid="button-wizard-next">
            {tipSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        )}
        {step === 8 && (
          <Button className="flex-1 h-12" onClick={handleNext} data-testid="button-wizard-done">
            <Check className="h-4 w-4 mr-2" /> Done — View Receipt
          </Button>
        )}
      </div>

      {/* ── Assign People Sheet ── */}
      <BottomSheet open={!!assignSheet} onClose={() => { setAssignSheet(null); setAutoAdvanceMode(false); }}
        title={assignSheet?.itemIds.length === 1
          ? <div className="flex items-center justify-between w-full">
              <span>Who had a <strong>{assignSheet?.label}</strong>?</span>
              {autoAdvanceMode && (
                <button type="button" onClick={skipAndNext} disabled={isAssigning}
                  className="text-sm font-normal text-muted-foreground hover:text-foreground transition-colors ml-2 flex-shrink-0 disabled:opacity-40"
                  data-testid="button-skip-item">
                  Skip
                </button>
              )}
            </div>
          : `Assign ${assignSheet?.itemIds.length ?? ""} items`}
        footer={(() => {
          const isSingle = assignSheet?.itemIds.length === 1;
          const seqRemaining = getSeqItems(items, new Set([
            ...seqProcessed,
            ...(assignSheet?.itemIds ?? []),
          ]));
          const isLast = seqRemaining.length === 0;

          if (autoAdvanceMode && isSingle) {
            return (
              <Button className="w-full h-12" disabled={assignPeople.length === 0 || isAssigning}
                onClick={confirmAssignAndNext} data-testid="button-assign-and-next">
                {isAssigning
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : isLast
                    ? "Assign and review"
                    : "Assign and continue"}
              </Button>
            );
          }

          return (
            <Button className="w-full h-12" disabled={assignPeople.length === 0 || isAssigning}
              onClick={confirmAssign} data-testid="button-confirm-assign">
              {isAssigning
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : `Assign to ${assignPeople.length === peopleWithColors.length && assignPeople.length > 0 ? "everyone" : `${assignPeople.length} person${assignPeople.length !== 1 ? "s" : ""}`}`}
            </Button>
          );
        })()}
        subtitle={(() => {
          if (!assignSheet || assignSheet.itemIds.length !== 1) return undefined;
          const item = items.find(i => i.id === assignSheet.itemIds[0]);
          if (!item) return undefined;
          const linePrice = parseFloat(item.price);
          const qty = drawerQtyOverrides[item.id] ?? item.quantity ?? 1;
          const effectiveCat = drawerCatOverrides[item.id] ?? item.category ?? "__none__";
          const catOptions = [...Object.entries(CAT_LABELS_SINGULAR), ["__none__", "Uncategorized"]] as [string, string][];
          return (
            <div className="flex items-center gap-2">
              {/* Qty stepper */}
              <div className="flex items-center gap-1.5">
                <Button size="icon" variant="outline"
                  onClick={() => changeItemQuantity(item.id, qty - 1)}
                  disabled={qty <= 1}
                  data-testid={`button-qty-minus-${item.id}`}>
                  <span className="text-base leading-none select-none">−</span>
                </Button>
                <span className="w-5 text-center text-sm font-semibold tabular-nums" data-testid={`text-qty-${item.id}`}>{qty}</span>
                <Button size="icon" variant="outline"
                  onClick={() => changeItemQuantity(item.id, qty + 1)}
                  data-testid={`button-qty-plus-${item.id}`}>
                  <span className="text-base leading-none select-none">+</span>
                </Button>
              </div>
              {/* Receipt total — fixed, never recalculated */}
              <span className="text-sm font-medium tabular-nums" data-testid={`text-item-price-${item.id}`}>
                ${linePrice.toFixed(2)}
              </span>
              <Select value={effectiveCat} onValueChange={v => changeItemCategory(item.id, v)}>
                <SelectTrigger className="w-auto h-7 text-xs gap-1 px-2 border-dashed" data-testid={`select-cat-${item.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {catOptions.map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })()}>
        <div className="space-y-4 pb-2">
          {/* ── Bulk item meta: category + price per item ── */}
          {assignSheet && assignSheet.itemIds.length > 1 && (() => {
            const sheetItems = assignSheet.itemIds.map(id => items.find(i => i.id === id)).filter(Boolean) as ReceiptItem[];
            const effectiveCat = (id: string) => drawerCatOverrides[id] ?? items.find(i => i.id === id)?.category ?? "__none__";
            const catOptions = [...Object.entries(CAT_LABELS), ["__none__", "Uncategorized"]] as [string, string][];

            // Bulk: list each item with category + price
            return (
              <div className="space-y-1 rounded-md border border-border overflow-hidden">
                {sheetItems.map((item, idx) => {
                  const unitPrice = parseFloat(item.price);
                  const qty = item.quantity ?? 1;
                  const totalPrice = unitPrice * qty;
                  return (
                    <div key={item.id}
                      className={`flex items-center gap-2 px-3 py-2 ${idx < sheetItems.length - 1 ? "border-b border-border" : ""}`}>
                      <span className="flex-1 text-sm truncate">{item.name}</span>
                      <Select value={effectiveCat(item.id)} onValueChange={v => changeItemCategory(item.id, v)}>
                        <SelectTrigger className="w-auto h-6 text-xs gap-1 px-2 border-dashed shrink-0" data-testid={`select-cat-${item.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catOptions.map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0" data-testid={`text-item-price-${item.id}`}>
                        ${totalPrice.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {(() => {
            const currentCat = assignSheet?.itemIds.length === 1
              ? (drawerCatOverrides[assignSheet.itemIds[0]] ?? items.find(i => i.id === assignSheet.itemIds[0])?.category)
              : null;

            const isSingleMeal = currentCat === "meal" && diningFormat === "courses";
            const mealItems = isSingleMeal
              ? items.filter(i => i.category === "meal" && i.id !== assignSheet!.itemIds[0])
              : [];

            const isSingleDrink = currentCat === "drink";
            const drinkItems = isSingleDrink
              ? items.filter(i => i.category === "drink" && i.id !== assignSheet!.itemIds[0])
              : [];

            const getAnnotation = (isSingleMeal || isSingleDrink)
              ? (personId: string) => {
                  if (isSingleMeal) {
                    const theirMeals = mealItems.filter(i => (i.assignedTo as string[])?.includes(personId));
                    if (theirMeals.length === 1)
                      return (
                        <span className="text-[10px] font-medium text-muted-foreground max-w-[72px] truncate leading-none"
                          title={theirMeals[0].name}>
                          {theirMeals[0].name}
                        </span>
                      );
                    if (theirMeals.length > 1)
                      return (
                        <span className="text-[10px] font-medium text-red-500 leading-none">
                          ×{theirMeals.length} entrees
                        </span>
                      );
                    return null;
                  }
                  if (isSingleDrink) {
                    const theirDrinks = drinkItems.filter(i => (i.assignedTo as string[])?.includes(personId));
                    if (theirDrinks.length === 1)
                      return (
                        <span className="text-[10px] text-muted-foreground max-w-[72px] truncate leading-none"
                          title={theirDrinks[0].name}>
                          {theirDrinks[0].name}
                        </span>
                      );
                    if (theirDrinks.length > 1)
                      return (
                        <span className="text-[10px] text-muted-foreground leading-none">
                          ×{theirDrinks.length} drinks
                        </span>
                      );
                    return null;
                  }
                  return null;
                }
              : undefined;

            return (
              <AssignPersonSheetBody
                people={peopleWithColors}
                selectedPeople={assignPeople}
                assignedQuantities={assignedQuantities}
                onSelectedPeopleChange={setAssignPeople}
                onAssignedQuantitiesChange={setAssignedQuantities}
                resetKey={assignSheet?.itemIds.join(",") ?? null}
                getChipAnnotation={getAnnotation}
              />
            );
          })()}

        </div>
      </BottomSheet>

      {/* ── Assign Step: Full Item Edit Sheet ── */}
      <BottomSheet
        open={!!assignEditSheet}
        onClose={() => setAssignEditSheet(null)}
        title="Edit Item"
        footer={
          <Button
            className="w-full h-12"
            onClick={() => {
              if (!assignEditSheet) return;
              saveAssignEdit.mutate({ id: assignEditSheet.id, data: { name: assignEditSheet.name, quantity: assignEditSheet.quantity, price: assignEditSheet.price, category: assignEditSheet.category } });
            }}
            disabled={!assignEditSheet?.name || !assignEditSheet?.price || saveAssignEdit.isPending}
            data-testid="button-save-assign-item-edit"
          >
            {saveAssignEdit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </Button>
        }
      >
        {assignEditSheet && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assign-edit-name">Item Name</Label>
              <Input
                id="assign-edit-name"
                value={assignEditSheet.name}
                onChange={e => setAssignEditSheet(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="e.g. Caesar Salad"
                data-testid="input-assign-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-edit-quantity">Quantity</Label>
              <Input
                id="assign-edit-quantity"
                type="number"
                min="1"
                value={assignEditSheet.quantity}
                onChange={e => setAssignEditSheet(prev => prev ? { ...prev, quantity: parseInt(e.target.value) || 1 } : null)}
                data-testid="input-assign-edit-quantity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-edit-price">Price</Label>
              <Input
                id="assign-edit-price"
                type="text"
                inputMode="decimal"
                value={assignEditSheet.price}
                onChange={e => setAssignEditSheet(prev => prev ? { ...prev, price: e.target.value } : null)}
                placeholder="0.00"
                data-testid="input-assign-edit-price"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: null, label: "None", Icon: Tag },
                  { value: "appetizer", label: "Appetizer", Icon: Salad },
                  { value: "meal", label: "Meal", Icon: UtensilsCrossed },
                  { value: "drink", label: "Drink", Icon: GlassWater },
                  { value: "dessert", label: "Dessert", Icon: Cake },
                  { value: "other", label: "Other", Icon: Tag },
                ] as const).map(({ value, label, Icon }) => {
                  const selected = (assignEditSheet.category ?? null) === value;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAssignEditSheet(prev => prev ? { ...prev, category: value } : null)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors
                        ${selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover-elevate"
                        }`}
                      data-testid={`button-assign-edit-category-${value ?? "none"}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* ── Review Step: Item Edit Dialog ── */}
      <Dialog open={!!reviewEditItem} onOpenChange={open => { if (!open) setReviewEditItem(null); }}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogTitle>Edit item</DialogTitle>
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Name</label>
              <Input value={reviewEditName} onChange={e => setReviewEditName(e.target.value)} data-testid="input-review-edit-name" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" step="0.01" value={reviewEditPrice} onChange={e => setReviewEditPrice(e.target.value)} className="pl-6" data-testid="input-review-edit-price" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive flex-shrink-0"
                onClick={async () => {
                  if (!reviewEditItem) return;
                  await apiRequest(`/api/items/${reviewEditItem.id}`, "DELETE");
                  await queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
                  setReviewEditItem(null);
                  toast({ title: "Item deleted" });
                }}
                data-testid="button-review-delete-item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setReviewEditItem(null)}>Cancel</Button>
              <Button className="flex-1" onClick={async () => {
                if (!reviewEditItem) return;
                await apiRequest(`/api/items/${reviewEditItem.id}`, "PATCH", {
                  name: reviewEditName.trim(),
                  price: reviewEditPrice,
                });
                await queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
                setReviewEditItem(null);
                toast({ title: "Item updated" });
              }} data-testid="button-review-edit-save">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ReviewItemsStep({ receiptId, items, receipt, subtotalDiff, fromExistingReceipt, onEditItem, isCategorizing }: {
  receiptId: string;
  items: ReceiptItem[];
  receipt: Receipt | undefined;
  subtotalDiff: number;
  fromExistingReceipt?: boolean;
  onEditItem: (item: ReceiptItem) => void;
  isCategorizing: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addPrice, setAddPrice] = useState("");
  // Restaurant name editing
  const [editingRestaurantName, setEditingRestaurantName] = useState(false);
  const [editRestaurantValue, setEditRestaurantValue] = useState("");
  // Scanned image viewer
  const [scannedImageUrl, setScannedImageUrl] = useState<string | null>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(`scanned_image_${receiptId}`);
    if (stored) { setScannedImageUrl(stored); return; }
    if (receipt?.imageUrl) setScannedImageUrl(receipt.imageUrl);
  }, [receiptId, receipt?.imageUrl]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId, "items"] });
    queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
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

  const saveRestaurantName = async () => {
    const trimmed = editRestaurantValue.trim();
    if (!trimmed) return;
    try {
      await apiRequest(`/api/receipts/${receiptId}`, "PATCH", { restaurantName: trimmed });
      invalidate();
      setEditingRestaurantName(false);
    } catch { toast({ title: "Failed to update restaurant name", variant: "destructive" }); }
  };

  const sub = parseFloat(receipt?.subtotal ?? "0") || 0;
  const itemsTotalUnit = items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);
  const itemsTotalLine = items.reduce((s, i) => s + parseFloat(i.price), 0);
  const itemsTotal = sub > 0 && Math.abs(itemsTotalLine - sub) < Math.abs(itemsTotalUnit - sub)
    ? itemsTotalLine
    : itemsTotalUnit;

  return (
    <div className="p-4 space-y-4">
      {subtotalDiff > 0.50 && sub > 0 && !fromExistingReceipt && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-300">
            <p className="font-semibold text-amber-800 dark:text-amber-200 mb-0.5">Items don't add up</p>
            Items total <strong>${itemsTotal.toFixed(2)}</strong> but receipt shows <strong>${sub.toFixed(2)}</strong> — check for missing items.
          </div>
        </div>
      )}

      {/* Restaurant name — click to edit, same pattern as admin receipt view */}
      <div className="relative flex items-center justify-center min-h-[2.25rem]">
        <button
          className="text-xl font-bold px-2 py-0.5 rounded-md border border-border/50 bg-transparent cursor-text mx-auto block text-center transition-colors hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => { setEditRestaurantValue(receipt?.restaurantName ?? ""); setEditingRestaurantName(true); }}
          data-testid="button-edit-restaurant-name"
        >
          {receipt?.restaurantName || "Unknown Restaurant"}
        </button>
        {scannedImageUrl && (
          <Button size="icon" variant="ghost" className="absolute right-0"
            onClick={() => setShowImageDialog(true)} data-testid="button-view-scanned-image">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Categorizing banner */}
      {isCategorizing && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/60 border border-border">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">Categorizing items…</p>
            <p className="text-xs text-muted-foreground">AI is sorting your items by type</p>
          </div>
        </div>
      )}

      {(() => {
        const showGrouped = !isCategorizing && items.some(i => i.category);
        const CAT_ORDER_LOCAL = ["appetizer", "meal", "dessert", "other", "drink", "__none__"] as const;

        const renderItemRow = (item: ReceiptItem) => (
          <div key={item.id} className="flex items-center divide-x">
            {/* Name + price */}
            <div className="flex-1 min-w-0 px-4 py-3">
              <div className="flex items-center gap-1.5 min-w-0">
                {item.quantity > 1 && !item.name.startsWith(`${item.quantity} `) && (
                  <span className="text-xs text-muted-foreground font-medium tabular-nums flex-shrink-0">{item.quantity}×</span>
                )}
                <p className="text-sm font-medium truncate">{item.name}</p>
              </div>
              <p className="text-xs text-muted-foreground">${parseFloat(item.price).toFixed(2)}</p>
            </div>
            {/* Pencil column — opens shared edit drawer */}
            <button
              onClick={() => onEditItem(item)}
              className="px-3 py-3 flex items-center justify-center self-stretch text-muted-foreground hover-elevate active-elevate-2 flex-shrink-0"
              data-testid={`button-edit-item-${item.id}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        );

        if (showGrouped) {
          const groups = CAT_ORDER_LOCAL
            .map(cat => ({
              cat,
              label: cat === "__none__" ? "Uncategorized" : CAT_LABELS[cat],
              groupItems: items.filter(i => (i.category ?? "__none__") === cat),
            }))
            .filter(g => g.groupItems.length > 0);
          return (
            <Card>
              <CardContent className="p-0">
                {groups.map((g, gi) => (
                  <div key={g.cat} className={gi > 0 ? "border-t" : ""}>
                    <div className="px-4 py-1.5 bg-muted/40 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {g.label}
                    </div>
                    <div className="divide-y">
                      {g.groupItems.map(item => renderItemRow(item))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        }

        return (
          <Card>
            <CardContent className="p-0 divide-y">
              {items.length === 0 && <p className="p-4 text-muted-foreground text-sm text-center">No items — add them below.</p>}
              {items.map(item => renderItemRow(item))}
            </CardContent>
          </Card>
        );
      })()}

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

      {/* Scanned image dialog */}
      <Dialog open={editingRestaurantName} onOpenChange={(open) => !open && setEditingRestaurantName(false)}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit Tab Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wizard-tab-name">Restaurant / Tab Name</Label>
              <Input
                id="wizard-tab-name"
                value={editRestaurantValue}
                onChange={e => setEditRestaurantValue(e.target.value)}
                placeholder="e.g., Joe's Pizza"
                onKeyDown={e => { if (e.key === "Enter" && editRestaurantValue.trim()) saveRestaurantName(); }}
                data-testid="input-restaurant-name"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditingRestaurantName(false)} data-testid="button-cancel-restaurant-name">
                Cancel
              </Button>
              <Button className="flex-1" onClick={saveRestaurantName} disabled={!editRestaurantValue.trim()} data-testid="button-save-restaurant-name">
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-sm p-2">
          <DialogTitle className="sr-only">Receipt scan</DialogTitle>
          {scannedImageUrl && (
            <img src={scannedImageUrl} alt="Scanned receipt" className="w-full rounded-md object-contain max-h-[80vh]" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssignCategorySection({ label, items, assigned, peopleWithColors, getPersonColor, onAssignAll, onAssignItem, onEditItem }: {
  label: string;
  items: ReceiptItem[];
  assigned: number;
  peopleWithColors: { id: string; name: string; color: string }[];
  getPersonColor: (pid: string) => string;
  onAssignAll: () => void;
  onAssignItem: (itemId: string, itemName: string) => void;
  onEditItem: (item: ReceiptItem) => void;
}) {
  const allAssigned = assigned === items.length;
  const someAssigned = assigned > 0 && !allAssigned;

  return (
    <div>
      {/* ── Category header — "Select all" row ── */}
      <button type="button" onClick={onAssignAll}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-muted/40 border-b hover-elevate active-elevate-2"
        data-testid={`button-assign-section-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        {/* Radio-style indicator */}
        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          allAssigned
            ? "border-primary bg-primary"
            : someAssigned
              ? "border-primary/50 bg-primary/10"
              : "border-muted-foreground/40"
        }`}>
          {allAssigned && <Check className="h-3 w-3 text-primary-foreground" />}
          {someAssigned && <div className="h-2 w-2 rounded-full bg-primary/70" />}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex-1 text-left">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {assigned > 0 ? `${assigned}/${items.length}` : `${items.length} items`}
        </span>
      </button>

      {/* ── Individual item rows ── */}
      <div className="divide-y">
        {items.map(item => {
          const assignedPeople = (item.assignedTo as string[]) || [];
          const isAssigned = assignedPeople.length > 0;
          const qty = item.quantity ?? 1;
          const nameHasCount = qty > 1 && item.name.startsWith(`${qty} `);
          const drawerLabel = qty > 1 && !nameHasCount ? `${qty}× ${item.name}` : item.name;
          return (
            <div key={item.id} className="flex items-center divide-x">
              <button type="button"
                onClick={() => onAssignItem(item.id, drawerLabel)}
                className="flex-1 flex items-center gap-3 px-4 py-2.5 hover-elevate active-elevate-2 text-left min-w-0"
                data-testid={`button-assign-item-${item.id}`}>
              {/* Per-item indicator */}
              <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                isAssigned ? "border-primary bg-primary" : "border-muted-foreground/30"
              }`}>
                {isAssigned && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {qty > 1 && !nameHasCount && (
                    <span className="text-muted-foreground font-medium mr-1">{qty}×</span>
                  )}
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground">${parseFloat(item.price).toFixed(2)}</p>
              </div>
              <div className="flex -space-x-1.5 flex-shrink-0">
                {!isAssigned && <span className="text-xs text-muted-foreground italic pr-1">tap to assign</span>}
                {assignedPeople.slice(0, 4).map(pid => {
                  const person = peopleWithColors.find(p => p.id === pid);
                  if (!person) return null;
                  return (
                    <div key={pid} title={person.name}
                      className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center ring-2 ring-background"
                      style={{ backgroundColor: person.color }}>
                      {getInitials(person.name)}
                    </div>
                  );
                })}
                {assignedPeople.length > 4 && (
                  <div className="w-7 h-7 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-xs font-semibold">
                    +{assignedPeople.length - 4}
                  </div>
                )}
              </div>
              </button>
              <button type="button"
                onClick={() => onEditItem(item)}
                className="px-3 py-2.5 flex items-center justify-center text-muted-foreground hover-elevate active-elevate-2 flex-shrink-0"
                data-testid={`button-edit-assign-item-${item.id}`}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
