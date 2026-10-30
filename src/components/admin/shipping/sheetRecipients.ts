// Recipients of a saved 출고시트 for the 수취인 조회 tab.
import type { SheetRecipient } from '../../../../api/shipping-sheets';
import type { Recipient, SheetRow } from './colosseum';

/** "Toothbrush 외 2개" */
export const productSummary = (products: string[]) => {
  const names = products.map((p) => p.trim()).filter(Boolean);
  return names.length > 1 ? `${names[0]} 외 ${names.length - 1}개` : names[0] ?? '';
};

/**
 * Recipients of a sheet for 수취인 조회, in card order: seeding cards get their sheet number, order cards
 * their Shopify number; the address is the one written to the sheet (W, on the card's first row).
 */
export function sheetRecipients(
  recipients: Recipient[], rows: SheetRow[], orders: Map<string, string>,
): SheetRecipient[] {
  let row = 0;
  return recipients.map((r) => {
    const first = rows[row];
    row += r.products.filter((p) => p.trim()).length;
    return {
      orderNo: r.order ? r.order.number : orders.get(r.id) ?? '',
      kind: r.order ? (r.order.b2b ? 'B2B' : 'B2C') : '시딩',
      name: r.name.trim(),
      // ISO code (US, SG): short enough for one line in the table.
      country: r.countryCode,
      address: String(first?.W ?? r.address),
      tracking: r.tracking.trim(),
      products: productSummary(r.products),
    };
  });
}
