import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, Check } from "lucide-react";

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
  bulkMode?: boolean;
  selected?: boolean;
  onLongPress?: () => void;
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
  bulkMode = false,
  selected = false,
  onLongPress,
  onBulkSelect,
}: ReceiptItemRowProps) {
  const isAssigned = assignedInitials.length > 0;
  const quantityDisplay = displayQuantity || quantity.toString();
  const isFraction = quantityDisplay.includes('/');
  const quantityText = isFraction ? quantityDisplay : `${quantityDisplay}x`;

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const startLongPress = () => {
    if (!onLongPress || bulkMode) return;
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      navigator.vibrate?.(40);
      onLongPress();
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div
      className={`flex items-center gap-3 py-3 transition-colors rounded-sm ${
        selected ? "bg-primary/10" : ""
      } ${!isAssigned && !bulkMode ? "opacity-60" : ""}`}
      data-testid="row-receipt-item"
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerMove={cancelLongPress}
      onPointerCancel={cancelLongPress}
    >
      {/* Bulk mode checkbox */}
      {bulkMode && (
        <button
          onClick={onBulkSelect}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            selected
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/50"
          }`}
          data-testid="button-bulk-select"
        >
          {selected && <Check className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* Tappable content area */}
      <div
        className="flex-1 min-w-0 cursor-pointer hover-elevate rounded-md -mx-1 px-1 py-0.5"
        onClick={() => {
          if (bulkMode) {
            onBulkSelect?.();
          } else if (!didLongPress.current) {
            onEdit?.();
          }
          didLongPress.current = false;
        }}
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

      {/* Normal mode: assign button */}
      {!bulkMode && (
        isAssigned ? (
          <button
            onClick={onAssign}
            className="flex -space-x-1 hover-elevate active-elevate-2 rounded-full p-0.5 transition-all flex-shrink-0"
            data-testid="button-modify-assignment"
          >
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
        )
      )}

      {/* Bulk mode: show faint avatars so user can see existing assignment at a glance */}
      {bulkMode && isAssigned && (
        <div className="flex -space-x-1 flex-shrink-0 opacity-40 pointer-events-none">
          {assignedInitials.slice(0, 4).map((initials, idx) => (
            <div
              key={idx}
              className="w-5 h-5 rounded-full text-white text-[10px] font-semibold flex items-center justify-center ring-1 ring-background"
              style={{ backgroundColor: assignedColors[idx] || "hsl(var(--primary))" }}
            >
              {initials}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
