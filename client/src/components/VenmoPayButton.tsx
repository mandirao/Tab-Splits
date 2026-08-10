import { Button } from "@/components/ui/button";

export default function VenmoPayButton({
  venmoUsername,
  amount,
  restaurantName,
  testId,
}: {
  venmoUsername: string;
  amount: number;
  restaurantName: string;
  testId: string;
}) {
  return (
    <Button
      className="w-full mt-1"
      onClick={() => {
        const username = encodeURIComponent(venmoUsername);
        const amountStr = amount.toFixed(2);
        const note = encodeURIComponent(`Tab Splits - ${restaurantName || 'Receipt'}`);
        window.location.href = `venmo://paycharge?txn=pay&recipients=${username}&amount=${amountStr}&note=${note}`;
      }}
      data-testid={testId}
    >
      Pay @{venmoUsername} on Venmo
    </Button>
  );
}
