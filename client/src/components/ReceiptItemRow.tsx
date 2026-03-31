import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

interface ReceiptItemRowProps {
  id: string;
  name: string;
  quantity: number;
  price: number;
  assignedInitials: string[];
  assignedColors?: string[];
  onAssign?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  displayQuantity?: string;
}

export default function ReceiptItemRow({
  name,
  quantity,
  price,
  assignedInitials,
  assignedColors = [],
  onAssign,
  onEdit,
  displayQuantity
}: ReceiptItemRowProps) {
  const isAssigned = assignedInitials.length > 0;
  const quantityDisplay = displayQuantity || quantity.toString();
  const isFraction = quantityDisplay.includes('/');
  const quantityText = isFraction ? quantityDisplay : `${quantityDisplay}x`;

  return (
    <div
      className={`flex items-center gap-3 py-3 ${!isAssigned ? 'opacity-60' : ''}`}
      data-testid="row-receipt-item"
    >
      {/* Tappable content area — opens editor */}
      <div
        className="flex-1 min-w-0 cursor-pointer hover-elevate rounded-md -mx-1 px-1 py-0.5"
        onClick={onEdit}
        data-testid="button-edit-item"
        role="button"
      >
        <div className="flex items-baseline gap-2">
          <Badge variant="outline" className="text-xs px-1.5" data-testid="badge-quantity">
            {quantityText}
          </Badge>
          <span className="font-medium text-sm" data-testid="text-item-name">{name}</span>
        </div>
        <span className="text-base font-semibold" data-testid="text-item-price">
          ${price.toFixed(2)}
        </span>
      </div>

      {/* Assign button */}
      {isAssigned ? (
        <button
          onClick={onAssign}
          className="flex -space-x-1 hover-elevate active-elevate-2 rounded-full p-0.5 transition-all flex-shrink-0"
          data-testid="button-modify-assignment"
        >
          {assignedInitials.map((initials, idx) => (
            <div
              key={idx}
              className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center ring-2 ring-background"
              style={{ backgroundColor: assignedColors[idx] || 'hsl(var(--primary))' }}
              data-testid={`badge-initials-${idx}`}
            >
              {initials}
            </div>
          ))}
        </button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={onAssign}
          className="flex-shrink-0"
          data-testid="button-assign"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
