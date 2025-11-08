import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, UserPlus } from "lucide-react";

interface ReceiptItemRowProps {
  id: string;
  name: string;
  quantity: number;
  price: number;
  assignedInitials: string[];
  assignedColors?: string[];
  onAssign?: () => void;
  onEdit?: () => void;
}

export default function ReceiptItemRow({
  name,
  quantity,
  price,
  assignedInitials,
  assignedColors = [],
  onAssign,
  onEdit
}: ReceiptItemRowProps) {
  const isAssigned = assignedInitials.length > 0;

  return (
    <div 
      className={`flex items-center gap-3 py-3 ${!isAssigned ? 'opacity-60' : ''}`}
      data-testid="row-receipt-item"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {quantity > 1 && (
            <Badge variant="outline" className="text-xs px-1.5" data-testid="badge-quantity">
              {quantity}x
            </Badge>
          )}
          <span className="font-medium text-sm" data-testid="text-item-name">{name}</span>
        </div>
        <span className="text-base font-semibold" data-testid="text-item-price">
          ${price.toFixed(2)}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        {isAssigned ? (
          <div className="flex -space-x-1" data-testid="container-initials">
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
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onAssign}
            data-testid="button-assign"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        )}
        
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          data-testid="button-edit-item"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
