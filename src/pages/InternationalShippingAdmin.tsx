import { useState } from 'react';
import { Ship } from 'lucide-react';
import { ManagePageHeader } from '@/components/admin/ManageLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ColosseumShippingForm from '@/components/admin/shipping/ColosseumShippingForm';
import ShippingSheetList from '@/components/admin/shipping/ShippingSheetList';
import RecipientLookup from '@/components/admin/shipping/RecipientLookup';

export default function InternationalShippingAdmin() {
  const [tab, setTab] = useState('register');
  return (
    <div>
      <ManagePageHeader icon={Ship} heading="Global Shipping" />
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="register">출고 등록</TabsTrigger>
            <TabsTrigger value="sheets">출고시트</TabsTrigger>
            <TabsTrigger value="recipients">수취인 조회</TabsTrigger>
          </TabsList>
          {/* Kept mounted: the cards being written survive a look at 출고시트. */}
          <TabsContent value="register" forceMount className="mt-0 data-[state=inactive]:hidden">
            <ColosseumShippingForm />
          </TabsContent>
          {/* Mounted when opened, so the lists are fetched again each time. */}
          <TabsContent value="sheets" className="mt-0">
            <ShippingSheetList />
          </TabsContent>
          <TabsContent value="recipients" className="mt-0">
            <RecipientLookup />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
