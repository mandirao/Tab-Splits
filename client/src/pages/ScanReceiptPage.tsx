import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Camera, Upload, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ScanReceiptPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const createReceiptMutation = useMutation({
    mutationFn: async (data: { 
      restaurantName?: string; 
      subtotal: number; 
      tax: number; 
      tip: number; 
      total: number;
      items: Array<{ name: string; quantity: number; price: number }>;
    }) => {
      const receipt: any = await apiRequest("/api/receipts", "POST", {
        restaurantName: data.restaurantName || "Unknown Restaurant",
        subtotal: data.subtotal.toFixed(2),
        tax: data.tax.toFixed(2),
        tip: data.tip.toFixed(2),
        total: data.total.toFixed(2)
      });
      
      for (const item of data.items) {
        await apiRequest(`/api/receipts/${receipt.id}/items`, "POST", {
          name: item.name,
          quantity: item.quantity,
          price: item.price.toFixed(2)
        });
      }
      
      return receipt;
    },
    onSuccess: (receipt) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({ title: "Receipt scanned successfully!" });
      setLocation(`/receipt/${receipt.id}`);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to save receipt", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleScanReceipt = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    try {
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const response = await apiRequest("/api/scan-receipt", "POST", {
        image: base64Image
      });

      console.log("Vision API Response:", response);
      
      if (!response.items || response.items.length === 0) {
        const receipt = await apiRequest("/api/receipts", "POST", {
          restaurantName: response.restaurantName || "Manual Entry",
          subtotal: "0.00",
          tax: "0.00",
          tip: "0.00",
          total: "0.00"
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
        toast({
          title: "No items detected",
          description: "Taking you to manual entry...",
        });
        setLocation(`/receipt/${receipt.id}`);
        return;
      }

      const itemsSubtotal = response.items.reduce((sum: number, item: any) => 
        sum + (item.price * item.quantity), 0
      );
      const expectedTotal = response.subtotal + response.tax + response.tip;
      const subtotalDiff = Math.abs(itemsSubtotal - response.subtotal);
      const totalDiff = Math.abs(expectedTotal - response.total);

      const hasWarning = subtotalDiff > 0.50 || totalDiff > 0.50;
      
      if (hasWarning) {
        console.warn("Math validation failed:", {
          itemsSubtotal,
          reportedSubtotal: response.subtotal,
          subtotalDiff,
          expectedTotal,
          reportedTotal: response.total,
          totalDiff
        });
      }

      const receipt = await createReceiptMutation.mutateAsync({
        restaurantName: response.restaurantName,
        items: response.items,
        subtotal: response.subtotal,
        tax: response.tax,
        tip: response.tip,
        total: response.total
      });

      // Always save the scanned image for reference
      sessionStorage.setItem(`scanned_image_${receipt.id}`, previewUrl);

      if (hasWarning) {
        sessionStorage.setItem(`receipt-${receipt.id}-warning`, JSON.stringify({
          scannedImage: previewUrl,
          itemCount: response.items.length,
          subtotalDiff: subtotalDiff.toFixed(2),
          totalDiff: totalDiff.toFixed(2)
        }));
      }
      
      return receipt;
      
    } catch (error: any) {
      console.error("Scan Error:", error);
      toast({
        title: "Scan failed",
        description: error.message || "Could not read the receipt. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      
      <header className="flex-shrink-0 p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Scan Receipt</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <Card>
          <CardContent className="p-6">
            {!previewUrl ? (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-muted-foreground mb-6">
                    Take a photo or upload an image of your receipt
                  </p>
                </div>
                
                <div className="space-y-3">
                  <label className="block cursor-pointer">
                    <div className="flex items-center justify-center gap-2 w-full h-14 bg-primary text-primary-foreground rounded-md font-medium transition-colors hover:bg-primary/90">
                      <Camera className="h-5 w-5" />
                      <span>Take Photo</span>
                    </div>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                      className="sr-only"
                      data-testid="input-camera"
                    />
                  </label>
                  
                  <label className="block cursor-pointer">
                    <div className="flex items-center justify-center gap-2 w-full h-14 border border-input bg-background text-foreground rounded-md font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                      <Upload className="h-5 w-5" />
                      <span>Upload Image</span>
                    </div>
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                      className="sr-only"
                      data-testid="input-upload"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden bg-muted">
                  <img 
                    src={previewUrl} 
                    alt="Receipt preview" 
                    className="w-full h-auto max-h-96 object-contain"
                    data-testid="img-receipt-preview"
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl("");
                    }}
                    disabled={isProcessing}
                    data-testid="button-retake"
                  >
                    Retake
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleScanReceipt}
                    disabled={isProcessing || createReceiptMutation.isPending}
                    data-testid="button-scan"
                  >
                    {isProcessing || createReceiptMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isProcessing ? "Scanning..." : "Saving..."}
                      </>
                    ) : (
                      "Scan Receipt"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">Tips for best results:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Ensure the receipt is well-lit and in focus</li>
            <li>• Place the receipt flat on a contrasting surface</li>
            <li>• Include the entire receipt in the frame</li>
            <li>• Avoid shadows and glare</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
