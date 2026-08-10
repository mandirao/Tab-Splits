import { X } from "lucide-react";

interface PersonChipProps {
  name: string;
  initials?: string;
  color?: string;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
}

export default function PersonChip({
  name,
  color = 'hsl(var(--primary))',
  selected = false,
  onSelect,
  onRemove,
  showRemove = false
}: PersonChipProps) {
  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer
        transition-colors text-sm font-medium
        ${selected
          ? 'text-white border-transparent'
          : 'border-border text-foreground hover-elevate'
        }
      `}
      style={selected ? { backgroundColor: color, borderColor: color } : undefined}
      onClick={onSelect}
      data-testid="chip-person"
    >
      {!selected && (
        <div
          className="w-3.5 h-3.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      <span>{name}</span>
      {showRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="ml-0.5 hover-elevate rounded-full p-0.5"
          data-testid="button-remove-person"
          aria-label={`Remove ${name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
