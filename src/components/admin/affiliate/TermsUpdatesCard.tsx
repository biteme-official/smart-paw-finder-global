import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyRow, SectionCard } from './adminUi';

// Placeholder: notices (and how partners see them) are specced later.
export function TermsUpdatesCard() {
  return (
    <SectionCard
      title="Terms updates"
      description="Notify partners before the affiliate terms change."
      action={
        <Button variant="outline" size="sm" onClick={() => toast('Coming soon.', { position: 'top-center' })}>
          <Plus className="h-4 w-4 mr-1" /> Create notice
        </Button>
      }
    >
      <EmptyRow>No notices yet.</EmptyRow>
    </SectionCard>
  );
}
