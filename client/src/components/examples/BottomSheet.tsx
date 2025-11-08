import BottomSheet from '../BottomSheet';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function BottomSheetExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Bottom Sheet</Button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Example Bottom Sheet"
        footer={
          <Button className="w-full" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          <p>This is content inside the bottom sheet.</p>
          <p>It can scroll if the content is long enough.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
        </div>
      </BottomSheet>
    </div>
  );
}
