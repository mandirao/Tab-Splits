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
import ReceiptCard from "@/components/ReceiptCard";
import { Camera, Search } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Receipt, ReceiptItem } from "@shared/schema";

interface ReceiptWithDetails extends Receipt {
  items?: ReceiptItem[];
}

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null);
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
      await apiRequest("DELETE", `/api/receipts/${receiptId}`);
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
