import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!isVisible) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        data-testid="overlay-bottom-sheet"
      />
      <div
        className={`fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-50 max-h-[85vh] flex flex-col transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        data-testid="container-bottom-sheet"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold" data-testid="text-bottom-sheet-title">{title}</h2>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
        {footer && (
          <div className="p-4 border-t">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
