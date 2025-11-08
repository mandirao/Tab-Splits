import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReceiptCard from "@/components/ReceiptCard";
import { Camera, Upload, Search } from "lucide-react";
import { useLocation } from "wouter";

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const mockReceipts = [
    {
      id: "1",
      restaurantName: "The Italian Kitchen",
      date: new Date("2024-03-15"),
      total: 127.50,
      peopleCount: 4,
      itemCount: 8
    },
    {
      id: "2",
      restaurantName: "Sushi Palace",
      date: new Date("2024-03-10"),
      total: 89.25,
      peopleCount: 2,
      itemCount: 6
    },
    {
      id: "3",
      restaurantName: "Burger Barn",
      date: new Date("2024-03-08"),
      total: 45.80,
      peopleCount: 3,
      itemCount: 5
    }
  ];

  const filteredReceipts = mockReceipts.filter(r => 
    !searchQuery || r.restaurantName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex-shrink-0 p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">SplitTab</h1>
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
        <div className="space-y-3 mb-24">
          {filteredReceipts.map((receipt) => (
            <ReceiptCard
              key={receipt.id}
              {...receipt}
              onClick={() => setLocation(`/receipt/${receipt.id}`)}
            />
          ))}
          {filteredReceipts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No receipts found</p>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
        <div className="flex gap-3">
          <Button 
            className="flex-1 h-12" 
            onClick={() => console.log('Camera clicked')}
            data-testid="button-camera"
          >
            <Camera className="h-5 w-5 mr-2" />
            Scan Receipt
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-12 w-12"
            onClick={() => console.log('Upload clicked')}
            data-testid="button-upload"
          >
            <Upload className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
