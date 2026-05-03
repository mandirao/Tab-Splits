import { useRef } from "react";
import { Check, Pencil } from "lucide-react";

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
  const quantityText = isFraction ? quantityDisplay : `${quantityDisplay}×`;

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
      className={`flex items-center divide-x transition-colors rounded-sm ${
        selected ? "bg-primary/10" : ""
      } ${!isAssigned && !bulkMode ? "opacity-60" : ""}`}
      data-testid="row-receipt-item"
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerMove={cancelLongPress}
      onPointerCancel={cancelLongPress}
    >
      {/* Main content area */}
      <div
        className={`flex-1 flex items-center gap-3 px-4 py-3 min-w-0 ${bulkMode ? "cursor-pointer hover-elevate" : ""}`}
        onClick={() => {
          if (bulkMode && !didLongPress.current) onBulkSelect?.();
          didLongPress.current = false;
        }}
        data-testid="button-edit-item"
        role={bulkMode ? "button" : undefined}
      >
        {/* Bulk mode checkbox */}
        {bulkMode && (
          <button
            onClick={e => { e.stopPropagation(); onBulkSelect?.(); }}
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

        {/* Name + price block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium flex-shrink-0 tabular-nums">{quantityText}</span>
            <span className="font-medium text-sm truncate" data-testid="text-item-name">{name}</span>
          </div>
          <p className="text-xs text-muted-foreground" data-testid="text-item-price">
            ${price.toFixed(2)}
          </p>
        </div>

        {/* Normal mode: assign bubbles or "Tap to assign" */}
        {!bulkMode && (
          <>
            {isAssigned ? (
              <button
                onClick={onAssign}
                className="flex -space-x-1.5 hover-elevate active-elevate-2 rounded-full p-0.5 transition-all flex-shrink-0"
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
              <button
                onClick={onAssign}
                className="text-xs text-muted-foreground italic flex-shrink-0 hover:text-foreground transition-colors"
                data-testid="button-assign"
              >
                Tap to assign
              </button>
            )}
          </>
        )}

        {/* Bulk mode: faint avatars */}
        {bulkMode && isAssigned && (
          <div className="flex -space-x-1.5 flex-shrink-0 opacity-40 pointer-events-none">
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

      {/* Pencil column — normal mode only */}
      {!bulkMode && (
        <button
          onClick={e => { e.stopPropagation(); onEdit?.(); }}
          className="px-3 py-3 flex items-center justify-center self-stretch text-muted-foreground hover-elevate active-elevate-2 flex-shrink-0"
          data-testid="button-edit-item-pencil"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
