import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Users } from "lucide-react";
import { format } from "date-fns";

interface ReceiptCardProps {
  id: string;
  restaurantName?: string;
  date: Date;
  total: number;
  peopleCount: number;
  itemCount: number;
  onClick?: () => void;
}

export default function ReceiptCard({
  restaurantName,
  date,
  total,
  peopleCount,
  itemCount,
  onClick
}: ReceiptCardProps) {
  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer"
      onClick={onClick}
      data-testid="card-receipt"
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
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
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
