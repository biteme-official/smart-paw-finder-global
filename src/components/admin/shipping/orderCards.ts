// Shopify order → recipient card fields, following the overseas team's sheet rules.
import {
  NO_STATE_COUNTRIES, findCountry, hasNoPostalCode, orderFullAddress, titleCaseIfAllCaps, type Country, type Recipient,
} from './colosseum';
import { normalizePhone } from './phone';
import { isB2BShipping, reorderShopifyName, type ShopifyOrder } from './shopifyOrders';

export type OrderCardFields = Omit<Recipient, 'id' | 'tracking'>;

/** An Address2 that is only digits is a phone number typed into the wrong field. */
const looksLikePhone = (v: string) => /^[\d\s+()-]+$/.test(v) && v.replace(/\D/g, '').length >= 6;

export function orderToCardFields(o: ShopifyOrder, countries: Country[]): { fields: OrderCardFields; country?: Country } {
  const country = countries.find((c) => c.code === o.country.toUpperCase()) ?? findCountry(o.country, countries);
  const dropAddress2 = looksLikePhone(o.address2);
  const address2 = dropAddress2 ? '' : o.address2;
  const { name, ambiguous } = reorderShopifyName(o.shippingName);
  const countryCode = country?.code ?? '';
  const city = titleCaseIfAllCaps(o.city, countryCode);
  // 수취인주: state / province code; countries without states get the country name.
  const state = country && NO_STATE_COUNTRIES.has(country.code) ? country.en : o.province || country?.en || '';
  // 수취인우편번호: blank for countries without postal codes; a missing one is typed by hand.
  const zip = hasNoPostalCode(countryCode) ? '' : o.zip;
  const lines = titleCaseIfAllCaps([o.address1, address2].filter(Boolean).join(', '), countryCode);
  return {
    country,
    fields: {
      // ALL-CAPS name / address / city arrive in normal capitalisation (codes kept).
      name: titleCaseIfAllCaps(name),
      // Same "+<calling code> <digits>" format as seeding shipments.
      phone: countryCode ? normalizePhone(o.phone, countryCode).value : o.phone,
      countryCode,
      // 전체 주소: the whole address in one line; city / state / zip below are filled on their own too.
      address: orderFullAddress(lines, { city, state, zip, countryCode }, country),
      city,
      state,
      zip,
      products: o.lines.length ? o.lines.map((l) => l.name) : [''],
      order: {
        number: o.number,
        currency: o.currency,
        total: o.total,
        b2b: isB2BShipping(o.shippingMethod),
        email: o.email,
        qtys: o.lines.length ? o.lines.map((l) => l.qty) : [1],
        prices: o.lines.length ? o.lines.map((l) => l.price) : [''],
        hasAddress2: !!address2,
        droppedAddress2: dropAddress2 ? o.address2 : undefined,
        nameAmbiguous: ambiguous,
        cancelledQty: o.cancelledQty || undefined,
        preShipment: o.preShipment || undefined,
        refundQtyCheck: o.refundQtyCheck || undefined,
      },
    },
  };
}
