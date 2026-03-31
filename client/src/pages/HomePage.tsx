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
import { Camera, Search, Users, Pencil, Trash2, Check, X, Phone } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Receipt, ReceiptItem, Person } from "@shared/schema";

interface ReceiptWithDetails extends Receipt {
  items?: ReceiptItem[];
}

function ManageDinersSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [deleteDialogPerson, setDeleteDialogPerson] = useState<Person | null>(null);

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

  const startEdit = (person: Person) => {
    setEditingId(person.id);
    setEditName(person.name);
    setEditPhone(person.phone ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate({ id: editingId, name: editName, phone: editPhone });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] flex flex-col p-0">
          <SheetHeader className="px-4 pt-5 pb-3 border-b flex-shrink-0">
            <SheetTitle className="text-lg">Manage Diners</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
            ) : people.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No saved diners yet</p>
                <p className="text-xs mt-1">Diners are saved when you add them to a tab</p>
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
                          <Button
                            size="sm"
                            onClick={saveEdit}
                            disabled={!editName.trim() || updateMutation.isPending}
                            data-testid={`button-save-diner-${person.id}`}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            {updateMutation.isPending ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                            data-testid={`button-cancel-edit-diner-${person.id}`}
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" data-testid={`text-diner-name-${person.id}`}>
                            {person.name}
                          </p>
                          {person.phone ? (
                            <p className="text-sm text-muted-foreground truncate" data-testid={`text-diner-phone-${person.id}`}>
                              {person.phone}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground/50 italic">No phone</p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(person)}
                            data-testid={`button-edit-diner-${person.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeleteDialogPerson(person)}
                            data-testid={`button-delete-diner-${person.id}`}
                          >
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
            <h1 className="text-2xl font-bold">SplitTab</h1>
            <p className="text-xs text-muted-foreground">by Amuse-Bouche</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setManageDinersOpen(true)}
            data-testid="button-manage-diners"
            title="Manage diners"
          >
            <Users className="h-5 w-5" />
          </Button>
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
