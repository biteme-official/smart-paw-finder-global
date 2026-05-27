import { lookupFedexRate, getWeightBracket, MAX_WEIGHT_KG, type CountryCode } from './fedex-rates';

export interface BoxSpec {
  name: string;
  w: number; // cm
  d: number;
  h: number;
  volumeCm3: number;
  volumetricKg: number;
}

export const BOXES: BoxSpec[] = [
  { name: '1호', w: 22, d: 15, h: 10 },
  { name: '2호', w: 26, d: 22, h: 12 },
  { name: '3호', w: 36, d: 30, h: 14 },
  { name: '4호', w: 36, d: 30, h: 21 },
  { name: '5호', w: 45, d: 30, h: 24 },
  { name: '6호', w: 62, d: 44, h: 21 },
  { name: '7호', w: 60, d: 40, h: 40 },
  { name: '기타', w: 70, d: 50, h: 50 },
].map(b => ({
  ...b,
  volumeCm3: b.w * b.d * b.h,
  volumetricKg: (b.w * b.d * b.h) / 5000,
}));

export interface ItemDimensions {
  widthCm: number;
  depthCm: number;
  heightCm: number;
  weightKg: number;
  quantity: number;
  productTitle: string;
  variantTitle: string;
}

export interface ShippingCalculation {
  items: ItemDimensions[];
  totalItemVolumeCm3: number;
  totalActualWeightKg: number;
  selectedBox: BoxSpec;
  boxVolumetricKg: number;
  chargeableWeightKg: number;
  chargeBasis: 'volumetric' | 'actual';
  weightBracket: string;
  rateKRW: number | null;
  rateUSD: number | null;
  countryCode: CountryCode;
  exceeds20kg: boolean;
}

const KRW_TO_USD = 1350;

export function selectBox(totalVolumeCm3: number): BoxSpec {
  for (const box of BOXES) {
    if (box.volumeCm3 >= totalVolumeCm3) return box;
  }
  return BOXES[BOXES.length - 1];
}

export function calculateShipping(
  items: ItemDimensions[],
  countryCode: CountryCode,
): ShippingCalculation {
  const totalItemVolumeCm3 = items.reduce(
    (sum, item) => sum + item.widthCm * item.depthCm * item.heightCm * item.quantity,
    0,
  );

  const totalActualWeightKg = items.reduce(
    (sum, item) => sum + item.weightKg * item.quantity,
    0,
  );

  const selectedBox = selectBox(totalItemVolumeCm3);
  const boxVolumetricKg = selectedBox.volumetricKg;
  const chargeableWeightKg = Math.max(boxVolumetricKg, totalActualWeightKg);
  const chargeBasis: 'volumetric' | 'actual' = boxVolumetricKg >= totalActualWeightKg ? 'volumetric' : 'actual';
  const exceeds20kg = chargeableWeightKg > MAX_WEIGHT_KG;

  const rateKRW = exceeds20kg ? null : lookupFedexRate(chargeableWeightKg, countryCode);
  const rateUSD = rateKRW != null ? Math.ceil(rateKRW / KRW_TO_USD) : null;

  return {
    items,
    totalItemVolumeCm3,
    totalActualWeightKg,
    selectedBox,
    boxVolumetricKg,
    chargeableWeightKg,
    chargeBasis,
    weightBracket: getWeightBracket(chargeableWeightKg),
    rateKRW,
    rateUSD,
    countryCode,
    exceeds20kg,
  };
}
