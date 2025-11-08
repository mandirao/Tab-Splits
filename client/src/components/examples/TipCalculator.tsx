import TipCalculator from '../TipCalculator';
import { useState } from 'react';

export default function TipCalculatorExample() {
  const [tipPercentage, setTipPercentage] = useState(20);
  const [tipAmount, setTipAmount] = useState(20.00);
  const subtotal = 100.00;

  return (
    <div className="p-4">
      <TipCalculator
        subtotal={subtotal}
        tipPercentage={tipPercentage}
        tipAmount={tipAmount}
        onTipPercentageChange={setTipPercentage}
        onTipAmountChange={setTipAmount}
      />
    </div>
  );
}
