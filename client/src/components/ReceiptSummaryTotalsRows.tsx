export default function ReceiptSummaryTotalsRows({
  subtotal,
  tax,
  tip,
  total,
  totalTestId,
  subtotalTestId,
  taxTestId,
  tipTestId,
}: {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  totalTestId: string;
  subtotalTestId?: string;
  taxTestId?: string;
  tipTestId?: string;
}) {
  return (
    <>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span data-testid={subtotalTestId}>${subtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Tax</span>
        <span data-testid={taxTestId}>${tax.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Tip</span>
        <span data-testid={tipTestId}>${tip.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-lg font-bold pt-2 border-t">
        <span>Total</span>
        <span data-testid={totalTestId}>${total.toFixed(2)}</span>
      </div>
    </>
  );
}
