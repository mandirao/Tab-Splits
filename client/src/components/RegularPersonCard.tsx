import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, X } from "lucide-react";

interface RegularPersonCardProps {
  name: string;
  initials: string;
  phone?: string;
  email?: string;
  onSelect?: () => void;
  onRemove?: () => void;
}

export default function RegularPersonCard({
  name,
  initials,
  phone,
  email,
  onSelect,
  onRemove
}: RegularPersonCardProps) {
  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer relative"
      onClick={onSelect}
      data-testid="card-regular-person"
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate" data-testid="text-person-name">{name}</h3>
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {phone && (
                <div className="flex items-center gap-1" data-testid="text-phone">
                  <Phone className="h-3 w-3" />
                  <span>{phone}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-1" data-testid="text-email">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{email}</span>
                </div>
              )}
            </div>
          </div>
          {onRemove && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              data-testid="button-remove"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
