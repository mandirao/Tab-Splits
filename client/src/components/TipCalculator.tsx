import { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface TipCalculatorProps {
  subtotal: number;
  tipPercentage: number;
  tipAmount: number;
  onTipPercentageChange: (percentage: number) => void;
  onTipAmountChange: (amount: number) => void;
  onSave?: () => void;
}

const QUICK_TIP_PERCENTAGES = [15, 18, 20, 25];

export default function TipCalculator({
  subtotal,
  tipPercentage,
  tipAmount,
  onTipPercentageChange,
  onTipAmountChange,
  onSave,
}: TipCalculatorProps) {
  const [customMode, setCustomMode] = useState(
    !QUICK_TIP_PERCENTAGES.includes(Math.round(tipPercentage))
  );

  const [pctStr, setPctStr] = useState(() =>
    tipPercentage > 0 ? tipPercentage.toFixed(1) : ""
  );
  const [amtStr, setAmtStr] = useState(() =>
    tipAmount > 0 ? tipAmount.toFixed(2) : ""
  );

  // Which field the user is actively editing — locks the other field to read-only
  const [activeField, setActiveField] = useState<"pct" | "amt" | null>(null);

  const pctInputRef = useRef<HTMLInputElement>(null);
  const amtInputRef = useRef<HTMLInputElement>(null);

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
    setActiveField(null);
    lastPresetRef.current = pct;
    onTipPercentageChange(pct);
    onTipAmountChange((subtotal * pct) / 100);
  };

  const handleCustomClick = () => {
    setCustomMode(true);
    setActiveField("amt");
    setTimeout(() => amtInputRef.current?.focus(), 50);
  };

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

  const clearPct = () => {
    setPctStr("");
    setAmtStr("");
    onTipPercentageChange(0);
    onTipAmountChange(0);
    pctInputRef.current?.focus();
  };

  const clearAmt = () => {
    setAmtStr("");
    setPctStr("");
    onTipAmountChange(0);
    onTipPercentageChange(0);
    amtInputRef.current?.focus();
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
            {/* Percentage field */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Percentage</label>
              {activeField === "amt" ? (
                <div className="flex items-center h-9 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground select-none">
                  <span className="flex-1">{pctStr || "—"}</span>
                  <span className="ml-1">%</span>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    ref={pctInputRef}
                    type="number"
                    min="0"
                    value={pctStr}
                    placeholder="0"
                    onFocus={() => setActiveField("pct")}
                    onChange={(e) => handlePctChange(e.target.value)}
                    className="pr-12"
                    data-testid="input-tip-percentage"
                  />
                  <div className="absolute right-0 top-0 h-full flex items-center gap-0.5 pr-2">
                    {pctStr !== "" && activeField === "pct" && (
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); clearPct(); }}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                        data-testid="button-clear-pct"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Amount field */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
              {activeField === "pct" ? (
                <div className="flex items-center h-9 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground select-none">
                  <span className="mr-1">$</span>
                  <span className="flex-1">{amtStr || "—"}</span>
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    ref={amtInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    value={amtStr}
                    placeholder="0.00"
                    onFocus={() => setActiveField("amt")}
                    onChange={(e) => handleAmtChange(e.target.value)}
                    className="pl-6 pr-8"
                    data-testid="input-tip-amount"
                  />
                  {amtStr !== "" && activeField === "amt" && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); clearAmt(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
                      data-testid="button-clear-amt"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {!customMode && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{tipPercentage.toFixed(0)}% of ${subtotal.toFixed(2)}</span>
            <span className="font-medium">${tipAmount.toFixed(2)}</span>
          </div>
        )}

        {onSave && (
          <Button className="w-full" onClick={onSave} data-testid="button-save-tip">
            Save Changes
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
