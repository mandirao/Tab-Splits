import PersonSummaryCard from '../PersonSummaryCard';

export default function PersonSummaryCardExample() {
  const mockItems = [
    { name: "Margherita Pizza", quantity: 1, price: 12.00 },
    { name: "House Wine", quantity: 1, price: 8.00 },
    { name: "Tiramisu", quantity: 1, price: 7.00 }
  ];

  return (
    <div className="p-4">
      <PersonSummaryCard
        name="John Doe"
        initials="JD"
        color="hsl(330, 75%, 65%)"
        items={mockItems}
        subtotal={27.00}
        taxShare={2.43}
        tipShare={5.40}
        total={34.83}
        onShare={() => console.log('Share clicked')}
      />
    </div>
  );
}
