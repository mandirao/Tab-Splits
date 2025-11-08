import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface PersonChipProps {
  name: string;
  initials: string;
  color?: string;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
}

export default function PersonChip({
  name,
  initials,
  color = 'hsl(var(--primary))',
  selected = false,
  onSelect,
  onRemove,
  showRemove = false
}: PersonChipProps) {
  return (
    <div
      className={`
        inline-flex items-center gap-2 h-10 px-3 rounded-lg border-2 cursor-pointer
        transition-colors
        ${selected 
          ? 'bg-primary/10 border-primary text-primary' 
          : 'bg-card border-border hover-elevate'
        }
      `}
      onClick={onSelect}
      data-testid="chip-person"
    >
      <div 
        className="w-6 h-6 rounded-full text-white text-xs font-semibold flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
      <span className="font-medium text-sm">{name}</span>
      {showRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="ml-1 hover-elevate rounded-full p-0.5"
          data-testid="button-remove-person"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
