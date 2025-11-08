import PersonChip from '../PersonChip';
import { useState } from 'react';

const PERSON_COLORS = [
  'hsl(330, 75%, 65%)',
  'hsl(340, 80%, 60%)',
  'hsl(25, 90%, 62%)',
];

export default function PersonChipExample() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="p-4 flex flex-wrap gap-2">
      <PersonChip
        name="John Doe"
        initials="JD"
        color={PERSON_COLORS[0]}
        selected={selected === 'JD'}
        onSelect={() => setSelected(selected === 'JD' ? null : 'JD')}
        showRemove={false}
      />
      <PersonChip
        name="Sarah Miller"
        initials="SM"
        color={PERSON_COLORS[1]}
        selected={selected === 'SM'}
        onSelect={() => setSelected(selected === 'SM' ? null : 'SM')}
        showRemove={false}
      />
      <PersonChip
        name="Alex Brown"
        initials="AB"
        color={PERSON_COLORS[2]}
        selected={selected === 'AB'}
        onSelect={() => setSelected(selected === 'AB' ? null : 'AB')}
        showRemove={true}
        onRemove={() => console.log('Remove clicked')}
      />
    </div>
  );
}
