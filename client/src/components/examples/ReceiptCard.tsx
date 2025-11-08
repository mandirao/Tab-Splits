import ReceiptCard from '../ReceiptCard';

export default function ReceiptCardExample() {
  return (
    <div className="p-4 space-y-4">
      <ReceiptCard
        id="1"
        restaurantName="The Italian Kitchen"
        date={new Date('2024-03-15')}
        total={127.50}
        peopleCount={4}
        itemCount={8}
        onClick={() => console.log('Receipt clicked')}
      />
      <ReceiptCard
        id="2"
        restaurantName="Sushi Palace"
        date={new Date('2024-03-10')}
        total={89.25}
        peopleCount={2}
        itemCount={6}
        onClick={() => console.log('Receipt clicked')}
      />
    </div>
  );
}
