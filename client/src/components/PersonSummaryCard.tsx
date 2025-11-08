import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";

interface PersonSummaryItem {
  name: string;
  quantity: number;
  price: number;
}

interface PersonSummaryCardProps {
  name: string;
  initials: string;
  items: PersonSummaryItem[];
  subtotal: number;
  taxShare: number;
  tipShare: number;
  total: number;
  onShare?: () => void;
}

export default function PersonSummaryCard({
  name,
  initials,
  items,
  subtotal,
  taxShare,
  tipShare,
  total,
  onShare
}: PersonSummaryCardProps) {
  return (
    <Card data-testid="card-person-summary">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">
            {initials}
          </div>
          <h3 className="font-semibold text-lg" data-testid="text-person-name">{name}</h3>
        </div>
        <Button size="sm" variant="outline" onClick={onShare} data-testid="button-share">
          <Share2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm" data-testid={`item-${idx}`}>
              <span className="text-muted-foreground">
                {item.quantity > 1 && `${item.quantity}x `}{item.name}
              </span>
              <span className="font-medium">${item.price.toFixed(2)}</span>
            </div>
          ))}
        </div>
        
        <div className="pt-3 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span data-testid="text-subtotal">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span data-testid="text-tax">${taxShare.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tip</span>
            <span data-testid="text-tip">${tipShare.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span data-testid="text-total">${total.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
