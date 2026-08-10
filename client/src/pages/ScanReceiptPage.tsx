import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Camera, Upload, Loader2, RotateCw, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { trySessionStore } from "@/lib/imageUtils";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";

export default function ScanReceiptPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { uploadFile } = useUpload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
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
    setRotation(0); // Reset rotation when new file is selected
  };

  const rotateLeft = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  const rotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Function to rotate image on canvas and return base64
  const getRotatedImageBase64 = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set canvas dimensions based on rotation
        if (rotation === 90 || rotation === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        // Translate and rotate
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        // Convert to base64
        const base64 = canvas.toDataURL('image/jpeg', 0.95);
        resolve(base64.split(',')[1]);
      };
      img.onerror = reject;
      img.src = previewUrl;
    });
  };

  const handleScanReceipt = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    try {
      // Use rotated image if rotation is applied
      const base64Image = await getRotatedImageBase64();

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
        sum + item.price, 0
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

      // Always save the rotated image for reference
      const rotatedImageDataUrl = `data:image/jpeg;base64,${base64Image}`;
      trySessionStore(`scanned_image_${receipt.id}`, rotatedImageDataUrl);
      
      // Upload image to object storage for sharing
      try {
        // Convert base64 to blob
        const byteCharacters = atob(base64Image);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });
        const file = new File([blob], `receipt-${receipt.id}.jpg`, { type: 'image/jpeg' });

        const uploaded = await uploadFile(file);
        if (uploaded) {
          await apiRequest(`/api/receipts/${receipt.id}`, "PATCH", {
            imageUrl: uploaded.objectPath
          });
        }
      } catch (uploadError) {
        console.warn("Failed to upload receipt image to storage:", uploadError);
      }

      if (hasWarning) {
        sessionStorage.setItem(`receipt-${receipt.id}-warning`, JSON.stringify({
          scannedImage: rotatedImageDataUrl,
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
                  
                  <Button
                    type="button"
                    className="w-full h-14"
                    onClick={() => cameraInputRef.current?.click()}
                    data-testid="button-take-photo"
                  >
                    <Camera className="h-5 w-5 mr-2" />
                    Take Photo
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-14"
                    onClick={() => uploadInputRef.current?.click()}
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
                    className="w-full h-auto max-h-96 object-contain transition-transform duration-300"
                    style={{ transform: `rotate(${rotation}deg)` }}
                    data-testid="img-receipt-preview"
                  />
                </div>
                
                <div className="flex items-center justify-center gap-2 pb-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={rotateLeft}
                    disabled={isProcessing}
                    data-testid="button-rotate-left"
                    title="Rotate left"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    {rotation === 0 ? "Portrait" : `${rotation}°`}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={rotateRight}
                    disabled={isProcessing}
                    data-testid="button-rotate-right"
                    title="Rotate right"
                  >
                    <RotateCw className="h-5 w-5" />
                  </Button>
                </div>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl("");
                      setRotation(0);
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
