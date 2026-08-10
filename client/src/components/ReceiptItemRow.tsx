import { Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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
  selected?: boolean;
  onBulkSelect?: () => void;
}

export default function ReceiptItemRow({
  name,
  quantity,
  price,
  assignedInitials,
  assignedColors = [],
  onAssign,
  onEdit,
  displayQuantity,
  selected = false,
  onBulkSelect,
}: ReceiptItemRowProps) {
  const isAssigned = assignedInitials.length > 0;
  const quantityDisplay = displayQuantity || quantity.toString();
  const isFraction = quantityDisplay.includes('/');
  const quantityText = isFraction ? quantityDisplay : `${quantityDisplay}×`;

  return (
    <div
      className={`flex items-center transition-colors rounded-sm ${
        selected ? "bg-primary/10" : ""
      } ${!isAssigned ? "opacity-60" : ""}`}
      data-testid="row-receipt-item"
    >
      {/* Selection checkbox — always visible, far left */}
      <div className="pl-4 pr-2 py-3 flex items-center flex-shrink-0">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onBulkSelect?.()}
          data-testid="button-bulk-select"
        />
      </div>

      <div className="flex-1 flex items-center divide-x min-w-0">
        {/* Name + price, edit pencil inline next to the title */}
        <div className="flex-1 px-4 py-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium flex-shrink-0 tabular-nums">{quantityText}</span>
            <span className="font-medium text-sm truncate" data-testid="text-item-name">{name}</span>
            <button
              onClick={onEdit}
              className="p-1 rounded-md text-muted-foreground hover-elevate active-elevate-2 flex-shrink-0"
              data-testid="button-edit-item-pencil"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground" data-testid="text-item-price">
            ${price.toFixed(2)}
          </p>
        </div>

        {/* Assign column — far right */}
        <button
          onClick={onAssign}
          className="px-3 py-3 flex items-center justify-center self-stretch hover-elevate active-elevate-2 flex-shrink-0"
          data-testid={isAssigned ? "button-modify-assignment" : "button-assign"}
        >
          {isAssigned ? (
            <div className="flex -space-x-1.5">
              {assignedInitials.map((initials, idx) => (
                <div
                  key={idx}
                  className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center ring-2 ring-background"
                  style={{ backgroundColor: assignedColors[idx] || "hsl(var(--primary))" }}
                  data-testid={`badge-initials-${idx}`}
                >
                  {initials}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic whitespace-nowrap">Tap to assign</span>
          )}
        </button>
      </div>
    </div>
  );
}
