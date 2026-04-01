import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ReceiptCard from "@/components/ReceiptCard";
import { Camera, Search, Users, Pencil, Trash2, Check, X, Phone, LogOut, Plus, UserPlus, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Receipt, ReceiptItem, Person } from "@shared/schema";

interface ReceiptWithDetails extends Receipt {
  items?: ReceiptItem[];
}

type AddMode = "contacts" | "manual";

function ManageDinersSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [deleteDialogPerson, setDeleteDialogPerson] = useState<Person | null>(null);

  // Add-diner state
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("manual");
  const [pendingContact, setPendingContact] = useState<{ name: string; phone: string } | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const contactsSupported = typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

  const { data: people = [], isLoading } = useQuery<Person[]>({
    queryKey: ["/api/people"],
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, phone }: { id: string; name: string; phone: string }) => {
      return await apiRequest(`/api/people/${id}`, "PATCH", {
        name: name.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : { phone: null }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setEditingId(null);
      toast({ title: "Diner updated" });
    },
    onError: () => {
      toast({ title: "Failed to update diner", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/people/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setDeleteDialogPerson(null);
      toast({ title: "Diner removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove diner", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; phone?: string }) => {
      return await apiRequest("/api/people", "POST", { ...data, isRegular: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      toast({ title: "Diner added" });
      resetAdd();
    },
    onError: (err: any) => {
      toast({ title: "Could not add diner", description: err.message, variant: "destructive" });
    },
  });

  const startEdit = (person: Person) => {
    setEditingId(person.id);
    setEditName(person.name);
    setEditPhone(person.phone ?? "");
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate({ id: editingId, name: editName, phone: editPhone });
  };

  const resetAdd = () => {
    setIsAdding(false);
    setPendingContact(null);
    setFirstName("");
    setLastName("");
    setNewPhone("");
  };

  const openAdd = () => {
    setAddMode(contactsSupported ? "contacts" : "manual");
    setIsAdding(true);
  };

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

  const handleAddFromContact = () => {
    if (!pendingContact?.name) return;
    createMutation.mutate({ name: pendingContact.name, ...(pendingContact.phone ? { phone: pendingContact.phone } : {}) });
  };

  const handleAddManually = () => {
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!name) return;
    createMutation.mutate({ name, ...(newPhone.trim() ? { phone: newPhone.trim() } : {}) });
  };

  const isBusy = createMutation.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) { resetAdd(); } onOpenChange(v); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] flex flex-col p-0">
          <SheetHeader className="px-4 pt-5 pb-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              {isAdding ? (
                <button
                  type="button"
                  onClick={resetAdd}
                  className="flex items-center gap-1 text-sm text-muted-foreground"
                  data-testid="button-back-to-diners"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <SheetTitle className="text-lg">Manage Diners</SheetTitle>
              )}
              {!isAdding && (
                <Button size="sm" onClick={openAdd} data-testid="button-add-diner">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Diner
                </Button>
              )}
            </div>
            {isAdding && (
              <SheetTitle className="text-lg mt-1">Add Diner</SheetTitle>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {isAdding ? (
              <div className="p-4 space-y-4">
                {/* Mode tabs */}
                <div className="flex gap-1 bg-muted rounded-md p-1">
                  {([
                    { id: "contacts" as const, label: "From Contacts", icon: Phone },
                    { id: "manual" as const, label: "Manual", icon: UserPlus },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { setAddMode(id); setPendingContact(null); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded transition-colors ${
                        addMode === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                      }`}
                      data-testid={`button-add-mode-${id}`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {addMode === "contacts" && (
                  <div className="space-y-3">
                    {pendingContact ? (
                      <>
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-semibold text-primary">
                              {pendingContact.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{pendingContact.name}</p>
                            {pendingContact.phone && (
                              <p className="text-xs text-muted-foreground">{pendingContact.phone}</p>
                            )}
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => setPendingContact(null)} data-testid="button-clear-contact">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button className="w-full" onClick={handleAddFromContact} disabled={!pendingContact.name || isBusy} data-testid="button-confirm-add-contact">
                          {isBusy ? "Adding…" : `Add ${pendingContact.name.split(" ")[0]}`}
                        </Button>
                      </>
                    ) : contactsSupported ? (
                      <Button variant="outline" className="w-full" onClick={handleOpenContacts} data-testid="button-open-contacts">
                        <Phone className="h-4 w-4 mr-2" />
                        Choose from Contacts
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Contact picking isn't supported in this browser. Switch to Manual to add someone.
                      </p>
                    )}
                  </div>
                )}

                {addMode === "manual" && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-medium mb-1">First name *</p>
                        <Input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Alex"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddManually(); }}
                          data-testid="input-add-first"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium mb-1">Last name</p>
                        <Input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Chen"
                          data-testid="input-add-last"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1">Phone <span className="text-muted-foreground font-normal">(optional)</span></p>
                      <Input
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                        data-testid="input-add-phone"
                      />
                    </div>
                    <Button className="w-full" onClick={handleAddManually} disabled={!firstName.trim() || isBusy} data-testid="button-add-manual">
                      {isBusy ? "Adding…" : "Add Diner"}
                    </Button>
                  </div>
                )}
              </div>
            ) : isLoading ? (
              <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
            ) : people.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm space-y-3">
                <Users className="h-8 w-8 mx-auto opacity-40" />
                <div>
                  <p className="font-medium text-foreground">No saved diners yet</p>
                  <p className="text-xs mt-1">Tap "Add Diner" above to get started</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y">
                {people.map((person) => (
                  <li key={person.id} className="px-4 py-3">
                    {editingId === person.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Full name"
                          data-testid={`input-edit-name-${person.id}`}
                          autoFocus
                        />
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="Phone (optional)"
                            type="tel"
                            className="pl-8"
                            data-testid={`input-edit-phone-${person.id}`}
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={saveEdit} disabled={!editName.trim() || updateMutation.isPending} data-testid={`button-save-diner-${person.id}`}>
                            <Check className="h-3.5 w-3.5 mr-1" />
                            {updateMutation.isPending ? "Saving…" : "Save"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit} data-testid={`button-cancel-edit-diner-${person.id}`}>
                            <X className="h-3.5 w-3.5 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" data-testid={`text-diner-name-${person.id}`}>{person.name}</p>
                          {person.phone ? (
                            <p className="text-sm text-muted-foreground truncate" data-testid={`text-diner-phone-${person.id}`}>{person.phone}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground/50 italic">No phone</p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(person)} data-testid={`button-edit-diner-${person.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteDialogPerson(person)} data-testid={`button-delete-diner-${person.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteDialogPerson} onOpenChange={(v) => { if (!v) setDeleteDialogPerson(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this diner?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDialogPerson?.name}" will be removed from your saved diners. This won't affect past receipts they were already added to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-diner">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialogPerson && deleteMutation.mutate(deleteDialogPerson.id)}
              className="bg-destructive text-destructive-foreground"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-diner"
            >
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null);
  const [manageDinersOpen, setManageDinersOpen] = useState(false);
  const { toast } = useToast();
  const { user, logout } = useAuth();

  const { data: receipts = [], isLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  const { data: allItems = [] } = useQuery<ReceiptItem[]>({
    queryKey: ["/api/items/all"],
    queryFn: async () => {
      if (!receipts.length) return [];
      const itemPromises = receipts.map(receipt =>
        fetch(`/api/receipts/${receipt.id}/items`).then(r => r.json())
      );
      const itemArrays = await Promise.all(itemPromises);
      return itemArrays.flat();
    },
    enabled: receipts.length > 0
  });

  const getItemCountForReceipt = (receiptId: string) => {
    return allItems.filter(item => item.receiptId === receiptId).length;
  };

  const getPeopleCountForReceipt = (receiptId: string) => {
    const items = allItems.filter(item => item.receiptId === receiptId);
    const uniquePeople = new Set(
      items.flatMap(item => (item.assignedTo as string[]) || [])
    );
    return uniquePeople.size;
  };

  const filteredReceipts = receipts.filter(r => 
    !searchQuery || r.restaurantName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteReceiptMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      await apiRequest(`/api/receipts/${receiptId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Tab deleted successfully" });
      setDeleteDialogOpen(false);
      setReceiptToDelete(null);
    },
    onError: () => {
      toast({ 
        title: "Failed to delete tab", 
        description: "Please try again",
        variant: "destructive" 
      });
    }
  });

  const handleDeleteClick = (receipt: Receipt) => {
    setReceiptToDelete(receipt);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (receiptToDelete) {
      deleteReceiptMutation.mutate(receiptToDelete.id);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex-shrink-0 p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Tab Splits</h1>
            {user && (
              <p className="text-xs text-muted-foreground">{user.name}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setManageDinersOpen(true)}
              data-testid="button-manage-diners"
              title="Manage diners"
            >
              <Users className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              data-testid="button-logout"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search receipts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Loading receipts...</p>
          </div>
        ) : (
          <div className="space-y-3 mb-24">
            {filteredReceipts.map((receipt) => (
              <ReceiptCard
                key={receipt.id}
                id={receipt.id}
                restaurantName={receipt.restaurantName || undefined}
                date={new Date(receipt.date)}
                total={parseFloat(receipt.total)}
                peopleCount={getPeopleCountForReceipt(receipt.id)}
                itemCount={getItemCountForReceipt(receipt.id)}
                onClick={() => setLocation(`/receipt/${receipt.id}`)}
                onDelete={() => handleDeleteClick(receipt)}
              />
            ))}
            {filteredReceipts.length === 0 && !isLoading && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No receipts found</p>
                <p className="text-sm mt-2">Scan or upload a receipt to get started</p>
              </div>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
        <Button 
          className="w-full h-12" 
          onClick={() => setLocation("/scan")}
          data-testid="button-camera"
        >
          <Camera className="h-5 w-5 mr-2" />
          Split new tab
        </Button>
      </div>

      <ManageDinersSheet open={manageDinersOpen} onOpenChange={setManageDinersOpen} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tab?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{receiptToDelete?.restaurantName || 'this tab'}" and all its data including items, people assignments, and payments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteReceiptMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteReceiptMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
