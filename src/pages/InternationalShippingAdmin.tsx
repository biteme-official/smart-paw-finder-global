import { Ship } from 'lucide-react';
import { ManagePageHeader } from '@/components/admin/ManageLayout';
import ColosseumShippingForm from '@/components/admin/shipping/ColosseumShippingForm';

export default function InternationalShippingAdmin() {
  return (
    <div>
      <ManagePageHeader icon={Ship} heading="해외배송" />
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        <ColosseumShippingForm />
      </main>
    </div>
  );
}
