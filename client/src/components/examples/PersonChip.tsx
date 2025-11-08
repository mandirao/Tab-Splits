import PersonChip from '../PersonChip';
import { useState } from 'react';

export default function PersonChipExample() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="p-4 flex flex-wrap gap-2">
      <PersonChip
        name="John Doe"
        initials="JD"
        selected={selected === 'JD'}
        onSelect={() => setSelected(selected === 'JD' ? null : 'JD')}
        showRemove={false}
      />
      <PersonChip
        name="Sarah Miller"
        initials="SM"
        selected={selected === 'SM'}
        onSelect={() => setSelected(selected === 'SM' ? null : 'SM')}
        showRemove={false}
      />
      <PersonChip
        name="Alex Brown"
        initials="AB"
        selected={selected === 'AB'}
        onSelect={() => setSelected(selected === 'AB' ? null : 'AB')}
        showRemove={true}
        onRemove={() => console.log('Remove clicked')}
      />
    </div>
  );
}
