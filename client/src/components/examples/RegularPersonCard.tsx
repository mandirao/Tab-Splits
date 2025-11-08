import RegularPersonCard from '../RegularPersonCard';

export default function RegularPersonCardExample() {
  return (
    <div className="p-4 space-y-3">
      <RegularPersonCard
        name="John Doe"
        initials="JD"
        phone="+1 555-0123"
        email="john@example.com"
        onSelect={() => console.log('Person selected')}
        onRemove={() => console.log('Remove clicked')}
      />
      <RegularPersonCard
        name="Sarah Miller"
        initials="SM"
        phone="+1 555-0456"
        onSelect={() => console.log('Person selected')}
        onRemove={() => console.log('Remove clicked')}
      />
    </div>
  );
}
