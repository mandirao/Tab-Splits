import RegularPersonCard from '../RegularPersonCard';

const PERSON_COLORS = [
  'hsl(330, 75%, 65%)',
  'hsl(340, 80%, 60%)',
];

export default function RegularPersonCardExample() {
  return (
    <div className="p-4 space-y-3">
      <RegularPersonCard
        name="John Doe"
        initials="JD"
        color={PERSON_COLORS[0]}
        phone="+1 555-0123"
        email="john@example.com"
        onSelect={() => console.log('Person selected')}
        onRemove={() => console.log('Remove clicked')}
      />
      <RegularPersonCard
        name="Sarah Miller"
        initials="SM"
        color={PERSON_COLORS[1]}
        phone="+1 555-0456"
        onSelect={() => console.log('Person selected')}
        onRemove={() => console.log('Remove clicked')}
      />
    </div>
  );
}
