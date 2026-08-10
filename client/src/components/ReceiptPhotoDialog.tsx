import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Image } from "lucide-react";

export default function ReceiptPhotoDialog({ imageUrl }: { imageUrl: string | null }) {
  if (!imageUrl) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-view-receipt-image">
          <Image className="h-3.5 w-3.5" />
          <span>View photo</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Receipt Photo</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center">
          <img
            src={imageUrl}
            alt="Original receipt"
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
            data-testid="img-receipt-scan"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
