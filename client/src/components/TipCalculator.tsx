import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TipCalculatorProps {
  subtotal: number;
  tipPercentage: number;
  tipAmount: number;
  onTipPercentageChange: (percentage: number) => void;
  onTipAmountChange: (amount: number) => void;
}

const QUICK_TIP_PERCENTAGES = [15, 18, 20, 25];

export default function TipCalculator({
  subtotal,
  tipPercentage,
  tipAmount,
  onTipPercentageChange,
  onTipAmountChange
}: TipCalculatorProps) {
  return (
    <Card data-testid="card-tip-calculator">
      <CardHeader className="pb-3">
        <h3 className="font-semibold text-base">Tip</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {QUICK_TIP_PERCENTAGES.map((pct) => (
            <Button
              key={pct}
              size="sm"
              variant={tipPercentage === pct ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                onTipPercentageChange(pct);
                onTipAmountChange((subtotal * pct) / 100);
              }}
              data-testid={`button-tip-${pct}`}
            >
              {pct}%
            </Button>
          ))}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Percentage</label>
            <div className="relative">
              <Input
                type="number"
                value={tipPercentage}
                onChange={(e) => {
                  const pct = parseFloat(e.target.value) || 0;
                  onTipPercentageChange(pct);
                  onTipAmountChange((subtotal * pct) / 100);
                }}
                className="pr-6"
                data-testid="input-tip-percentage"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                value={tipAmount.toFixed(2)}
                onChange={(e) => {
                  const amt = parseFloat(e.target.value) || 0;
                  onTipAmountChange(amt);
                  onTipPercentageChange(subtotal > 0 ? (amt / subtotal) * 100 : 0);
                }}
                className="pl-6"
                data-testid="input-tip-amount"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
