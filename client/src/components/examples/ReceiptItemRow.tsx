import ReceiptItemRow from '../ReceiptItemRow';

const PERSON_COLORS = [
  'hsl(38, 92%, 50%)',   // Amber
  'hsl(17, 81%, 53%)',   // Coral
  'hsl(345, 77%, 57%)',  // Raspberry
];

export default function ReceiptItemRowExample() {
  return (
    <div className="p-4 space-y-1 divide-y">
      <ReceiptItemRow
        id="1"
        name="Margherita Pizza"
        quantity={2}
        price={24.00}
        assignedInitials={['JD', 'SM']}
        assignedColors={[PERSON_COLORS[0], PERSON_COLORS[1]]}
        onAssign={() => console.log('Assign clicked')}
        onEdit={() => console.log('Edit clicked')}
      />
      <ReceiptItemRow
        id="2"
        name="Caesar Salad"
        quantity={1}
        price={12.50}
        assignedInitials={['AB']}
        assignedColors={[PERSON_COLORS[2]]}
        onAssign={() => console.log('Assign clicked')}
        onEdit={() => console.log('Edit clicked')}
      />
      <ReceiptItemRow
        id="3"
        name="Tiramisu"
        quantity={1}
        price={8.00}
        assignedInitials={[]}
        onAssign={() => console.log('Assign clicked')}
        onEdit={() => console.log('Edit clicked')}
      />
    </div>
  );
}
