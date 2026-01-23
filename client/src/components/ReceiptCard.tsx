import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, Users, MoreVertical, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface ReceiptCardProps {
  id: string;
  restaurantName?: string;
  date: Date;
  total: number;
  peopleCount: number;
  itemCount: number;
  onClick?: () => void;
  onDelete?: () => void;
}

export default function ReceiptCard({
  id,
  restaurantName,
  date,
  total,
  peopleCount,
  itemCount,
  onClick,
  onDelete
}: ReceiptCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const handleTouchStart = useCallback(() => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setMenuOpen(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (isLongPress.current || menuOpen) {
      e.preventDefault();
      e.stopPropagation();
      isLongPress.current = false;
      return;
    }
    onClick?.();
  }, [onClick, menuOpen]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    onDelete?.();
  }, [onDelete]);

  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer relative"
      onClick={handleCardClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
      data-testid={`card-receipt-${id}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate" data-testid="text-restaurant-name">
            {restaurantName || "Unknown Restaurant"}
          </h3>
          <p className="text-sm text-muted-foreground" data-testid="text-receipt-date">
            {format(date, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-menu-${id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDeleteClick}
                data-testid={`button-delete-${id}`}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Tab
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold" data-testid="text-receipt-total">
            ${total.toFixed(2)}
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1" data-testid="badge-people-count">
              <Users className="h-3 w-3" />
              {peopleCount}
            </Badge>
            <Badge variant="outline" data-testid="badge-item-count">
              {itemCount} items
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
