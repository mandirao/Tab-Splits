import ReceiptItemRow from '../ReceiptItemRow';

export default function ReceiptItemRowExample() {
  return (
    <div className="p-4 space-y-1 divide-y">
      <ReceiptItemRow
        id="1"
        name="Margherita Pizza"
        quantity={2}
        price={24.00}
        assignedInitials={['JD', 'SM']}
        onAssign={() => console.log('Assign clicked')}
        onEdit={() => console.log('Edit clicked')}
      />
      <ReceiptItemRow
        id="2"
        name="Caesar Salad"
        quantity={1}
        price={12.50}
        assignedInitials={['AB']}
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
