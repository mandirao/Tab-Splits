import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Camera, Upload, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Tesseract from 'tesseract.js';

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

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleUploadClick = () => {
    uploadInputRef.current?.click();
  };

  const extractReceiptData = async (text: string) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    const items: Array<{ name: string; quantity: number; price: number }> = [];
    let subtotal = 0;
    let tax = 0;
    let tip = 0;
    let total = 0;
    
    const priceRegex = /\$?(\d+\.?\d*)/;
    const quantityRegex = /^(\d+)x?\s+/i;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      if (line.includes('subtotal') || line.includes('sub total')) {
        const match = lines[i].match(priceRegex);
        if (match) subtotal = parseFloat(match[1]);
      } else if (line.includes('tax')) {
        const match = lines[i].match(priceRegex);
        if (match) tax = parseFloat(match[1]);
      } else if (line.includes('tip') || line.includes('gratuity')) {
        const match = lines[i].match(priceRegex);
        if (match) tip = parseFloat(match[1]);
      } else if (line.includes('total') && !line.includes('subtotal')) {
        const match = lines[i].match(priceRegex);
        if (match) total = parseFloat(match[1]);
      } else {
        const priceMatch = lines[i].match(/\$?(\d+\.?\d+)$/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1]);
          let itemName = lines[i].replace(/\$?(\d+\.?\d+)$/, '').trim();
          let quantity = 1;
          
          const qtyMatch = itemName.match(quantityRegex);
          if (qtyMatch) {
            quantity = parseInt(qtyMatch[1]);
            itemName = itemName.replace(quantityRegex, '').trim();
          }
          
          if (itemName && price > 0 && price < 1000) {
            items.push({
              name: itemName,
              quantity,
              price
            });
          }
        }
      }
    }
    
    if (total === 0 && subtotal > 0) {
      total = subtotal + tax + tip;
    }
    
    if (subtotal === 0 && items.length > 0) {
      subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }
    
    if (total === 0) {
      total = subtotal + tax + tip;
    }
    
    return {
      items: items.slice(0, 20),
      subtotal,
      tax,
      tip,
      total
    };
  };

  const handleScanReceipt = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    try {
      const result = await Tesseract.recognize(selectedFile, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      const extractedData = await extractReceiptData(result.data.text);
      
      if (extractedData.items.length === 0) {
        toast({
          title: "No items detected",
          description: "Could not find any items in the receipt. Please enter them manually.",
          variant: "destructive"
        });
        return;
      }
      
      await createReceiptMutation.mutateAsync(extractedData);
      
    } catch (error: any) {
      console.error("OCR Error:", error);
      toast({
        title: "Scan failed",
        description: "Could not read the receipt. Please try a clearer image.",
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
                
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                  data-testid="input-camera"
                />
                
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                  data-testid="input-upload"
                />
                
                <div className="space-y-3">
                  <Button 
                    className="w-full h-14" 
                    onClick={handleCameraClick}
                    data-testid="button-take-photo"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    Take Photo
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="w-full h-14" 
                    onClick={handleUploadClick}
                    data-testid="button-upload-image"
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    Upload Image
                  </Button>
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
