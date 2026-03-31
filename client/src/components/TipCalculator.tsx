import { useRef, useState, useEffect } from "react";
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
  const [customMode, setCustomMode] = useState(
    !QUICK_TIP_PERCENTAGES.includes(Math.round(tipPercentage))
  );

  // Local string state so the user can freely edit without recalculation feedback loops
  const [pctStr, setPctStr] = useState(() =>
    tipPercentage > 0 ? tipPercentage.toFixed(1) : ""
  );
  const [amtStr, setAmtStr] = useState(() =>
    tipAmount > 0 ? tipAmount.toFixed(2) : ""
  );

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Sync from parent only when not in the middle of user editing (preset changes)
  const lastPresetRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastPresetRef.current !== null) {
      setPctStr(tipPercentage > 0 ? tipPercentage.toFixed(1) : "");
      setAmtStr(tipAmount > 0 ? tipAmount.toFixed(2) : "");
      lastPresetRef.current = null;
    }
  }, [tipPercentage, tipAmount]);

  const isPresetActive = (pct: number) =>
    !customMode && Math.round(tipPercentage) === pct;

  const handlePreset = (pct: number) => {
    setCustomMode(false);
    lastPresetRef.current = pct;
    onTipPercentageChange(pct);
    onTipAmountChange((subtotal * pct) / 100);
  };

  const handleCustomClick = () => {
    setCustomMode(true);
    setTimeout(() => amountInputRef.current?.focus(), 50);
  };

  // When user finishes editing the percentage field, update the amount
  const handlePctChange = (raw: string) => {
    setPctStr(raw);
    const pct = parseFloat(raw);
    if (!isNaN(pct) && pct >= 0) {
      const amt = (subtotal * pct) / 100;
      setAmtStr(amt.toFixed(2));
      onTipPercentageChange(pct);
      onTipAmountChange(amt);
    } else if (raw === "" || raw === ".") {
      setAmtStr("");
      onTipPercentageChange(0);
      onTipAmountChange(0);
    }
  };

  // When user finishes editing the amount field, update the percentage
  const handleAmtChange = (raw: string) => {
    setAmtStr(raw);
    const amt = parseFloat(raw);
    if (!isNaN(amt) && amt >= 0) {
      const pct = subtotal > 0 ? (amt / subtotal) * 100 : 0;
      setPctStr(pct.toFixed(1));
      onTipAmountChange(amt);
      onTipPercentageChange(pct);
    } else if (raw === "" || raw === ".") {
      setPctStr("");
      onTipAmountChange(0);
      onTipPercentageChange(0);
    }
  };

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
              variant={isPresetActive(pct) ? "default" : "outline"}
              className="flex-1"
              onClick={() => handlePreset(pct)}
              data-testid={`button-tip-${pct}`}
            >
              {pct}%
            </Button>
          ))}
          <Button
            size="sm"
            variant={customMode ? "default" : "outline"}
            className="flex-1"
            onClick={handleCustomClick}
            data-testid="button-tip-custom"
          >
            Custom
          </Button>
        </div>

        {customMode && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Percentage</label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  value={pctStr}
                  placeholder="0"
                  onChange={(e) => handlePctChange(e.target.value)}
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
                  ref={amountInputRef}
                  type="number"
                  step="0.01"
                  min="0"
                  value={amtStr}
                  placeholder="0.00"
                  onChange={(e) => handleAmtChange(e.target.value)}
                  className="pl-6"
                  data-testid="input-tip-amount"
                />
              </div>
            </div>
          </div>
        )}

        {!customMode && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{tipPercentage.toFixed(0)}% of ${subtotal.toFixed(2)}</span>
            <span className="font-medium">${tipAmount.toFixed(2)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
