import { useState, useMemo } from 'react';
import { ChevronLeft, Package, Truck, Calculator, Box } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { calculateShipping, BOXES, type ItemDimensions } from '@/lib/shipping-calculator';
import { COUNTRY_MAP, type CountryCode } from '@/lib/fedex-rates';

const TEST_COMBOS: { name: string; items: ItemDimensions[] }[] = [
  {
    name: '테스트 1: 소형 3개',
    items: [
      { productTitle: 'Biteme Hate Me Patch (24pcs)', variantTitle: 'Default Title', widthCm: 14, depthCm: 13, heightCm: 0.1, weightKg: 0.01, quantity: 1 },
      { productTitle: 'BonBon Green Furry Friends Rattle Toy', variantTitle: 'BEAR', widthCm: 12, depthCm: 17.5, heightCm: 2.5, weightKg: 0.03, quantity: 1 },
      { productTitle: 'Biteme Comfort Harness v2', variantTitle: 'Yellow Mint / M', widthCm: 17, depthCm: 22, heightCm: 3, weightKg: 0.15, quantity: 1 },
    ],
  },
  {
    name: '테스트 2: 중형 2개',
    items: [
      { productTitle: 'BonBon Green Fluffy Snuffy Nosework Book Toy', variantTitle: 'Monkey', widthCm: 20, depthCm: 18.5, heightCm: 5.5, weightKg: 0.1, quantity: 1 },
      { productTitle: 'Latta Filmcover All-in-one windbreaker', variantTitle: 'Mauve Pink / XL', widthCm: 30, depthCm: 40, heightCm: 3, weightKg: 0.074, quantity: 1 },
    ],
  },
  {
    name: '테스트 3: 대형 + 소형 2개',
    items: [
      { productTitle: 'Apple Cider Recipe - Summer Stroller Liner', variantTitle: 'M / Sky blue', widthCm: 56, depthCm: 37, heightCm: 5, weightKg: 0.55, quantity: 1 },
      { productTitle: 'Biteme Hate Me Patch (24pcs)', variantTitle: 'Default Title', widthCm: 14, depthCm: 13, heightCm: 0.1, weightKg: 0.01, quantity: 1 },
      { productTitle: 'BonBon Green Furry Friends Rattle Toy', variantTitle: 'BEAR', widthCm: 12, depthCm: 17.5, heightCm: 2.5, weightKg: 0.03, quantity: 1 },
    ],
  },
  {
    name: '테스트 4: 대형 단품',
    items: [
      { productTitle: 'Biteme Napa Cabbage Toy', variantTitle: 'Default Title', widthCm: 65, depthCm: 40, heightCm: 52, weightKg: 0.05, quantity: 1 },
    ],
  },
];

function formatKRW(n: number) {
  return '₩' + n.toLocaleString();
}

export default function ShippingTest() {
  const navigate = useNavigate();
  const [selectedCombo, setSelectedCombo] = useState(0);
  const [countryCode, setCountryCode] = useState<CountryCode>('G');
  const [customItems, setCustomItems] = useState<ItemDimensions[]>([]);
  const [useCustom, setUseCustom] = useState(false);

  const items = useCustom ? customItems : TEST_COMBOS[selectedCombo].items;
  const result = useMemo(() => calculateShipping(items, countryCode), [items, countryCode]);

  const addCustomItem = () => {
    setCustomItems(prev => [
      ...prev,
      { productTitle: '새 상품', variantTitle: 'Default', widthCm: 10, depthCm: 10, heightCm: 10, weightKg: 0.1, quantity: 1 },
    ]);
  };

  const updateCustomItem = (idx: number, field: keyof ItemDimensions, value: string | number) => {
    setCustomItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeCustomItem = (idx: number) => {
    setCustomItems(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center px-4 h-14">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-center font-semibold">B2B Shipping Calculator (Dev)</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Country Selection */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Truck className="h-4 w-4" /> Destination Country
          </h2>
          <select
            value={countryCode}
            onChange={e => setCountryCode(e.target.value as CountryCode)}
            className="w-full p-2 border rounded-lg bg-background text-sm"
          >
            {COUNTRY_MAP.map(c => (
              <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
            ))}
          </select>
        </div>

        {/* Test Combo Selection */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Package className="h-4 w-4" /> Test Items
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {TEST_COMBOS.map((combo, i) => (
              <Button
                key={i}
                variant={!useCustom && selectedCombo === i ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setSelectedCombo(i); setUseCustom(false); }}
              >
                {combo.name}
              </Button>
            ))}
            <Button
              variant={useCustom ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUseCustom(true)}
            >
              Custom
            </Button>
          </div>

          {/* Items list */}
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg p-2">
                <div className="flex-1">
                  <span className="font-medium">{item.productTitle}</span>
                  {item.variantTitle !== 'Default Title' && (
                    <span className="text-muted-foreground"> / {item.variantTitle}</span>
                  )}
                  {useCustom ? (
                    <div className="flex gap-1 mt-1">
                      <input type="number" value={item.widthCm} onChange={e => updateCustomItem(i, 'widthCm', +e.target.value)} className="w-14 p-1 border rounded text-xs" placeholder="W" />
                      <span className="self-center">×</span>
                      <input type="number" value={item.depthCm} onChange={e => updateCustomItem(i, 'depthCm', +e.target.value)} className="w-14 p-1 border rounded text-xs" placeholder="D" />
                      <span className="self-center">×</span>
                      <input type="number" value={item.heightCm} onChange={e => updateCustomItem(i, 'heightCm', +e.target.value)} className="w-14 p-1 border rounded text-xs" placeholder="H" />
                      <span className="self-center text-muted-foreground">cm</span>
                      <input type="number" value={item.weightKg} step="0.01" onChange={e => updateCustomItem(i, 'weightKg', +e.target.value)} className="w-16 p-1 border rounded text-xs" placeholder="kg" />
                      <span className="self-center text-muted-foreground">kg</span>
                      <input type="number" value={item.quantity} min={1} onChange={e => updateCustomItem(i, 'quantity', +e.target.value)} className="w-10 p-1 border rounded text-xs" />
                      <span className="self-center text-muted-foreground">ea</span>
                      <button onClick={() => removeCustomItem(i)} className="text-red-500 px-1">×</button>
                    </div>
                  ) : (
                    <div className="text-muted-foreground mt-0.5">
                      {item.widthCm}×{item.depthCm}×{item.heightCm}cm | {item.weightKg}kg | qty: {item.quantity}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {useCustom && (
            <Button size="sm" variant="outline" className="mt-2 w-full" onClick={addCustomItem}>
              + Add Item
            </Button>
          )}
        </div>

        {/* Calculation Result */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Shipping Calculation
          </h2>

          {/* Step 1: Volume */}
          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Step 1. 상품 부피 합산</div>
              <div className="text-sm">
                총 상품 부피: <span className="font-bold">{result.totalItemVolumeCm3.toLocaleString()}cm³</span>
              </div>
              <div className="text-sm">
                총 실중량: <span className="font-bold">{result.totalActualWeightKg.toFixed(3)}kg</span>
              </div>
            </div>

            {/* Step 2: Box Selection */}
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Step 2. 박스 선택</div>
              <div className="flex items-center gap-2 text-sm">
                <Box className="h-4 w-4" />
                <span className="font-bold">{result.selectedBox.name}</span>
                <span className="text-muted-foreground">
                  ({result.selectedBox.w}×{result.selectedBox.d}×{result.selectedBox.h}cm = {result.selectedBox.volumeCm3.toLocaleString()}cm³)
                </span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <div className="grid grid-cols-4 gap-1">
                  {BOXES.map(box => (
                    <div
                      key={box.name}
                      className={`text-center p-1 rounded ${box.name === result.selectedBox.name ? 'bg-amber-200 dark:bg-amber-800 font-bold' : 'bg-muted/50'}`}
                    >
                      {box.name}<br />{box.volumeCm3.toLocaleString()}cm³
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 3: Chargeable Weight */}
            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3">
              <div className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1">Step 3. 적용 무게 (부피무게 vs 실중량)</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className={`p-2 rounded border ${result.chargeBasis === 'volumetric' ? 'border-purple-400 bg-purple-100 dark:bg-purple-900/30' : 'border-muted'}`}>
                  <div className="text-xs text-muted-foreground">박스 부피무게</div>
                  <div className="font-bold">{result.boxVolumetricKg.toFixed(2)}kg</div>
                  <div className="text-xs text-muted-foreground">({result.selectedBox.w}×{result.selectedBox.d}×{result.selectedBox.h}) ÷ 5000</div>
                  {result.chargeBasis === 'volumetric' && <div className="text-xs font-bold text-purple-600 mt-1">APPLIED</div>}
                </div>
                <div className={`p-2 rounded border ${result.chargeBasis === 'actual' ? 'border-purple-400 bg-purple-100 dark:bg-purple-900/30' : 'border-muted'}`}>
                  <div className="text-xs text-muted-foreground">상품 실중량 합</div>
                  <div className="font-bold">{result.totalActualWeightKg.toFixed(3)}kg</div>
                  {result.chargeBasis === 'actual' && <div className="text-xs font-bold text-purple-600 mt-1">APPLIED</div>}
                </div>
              </div>
              <div className="mt-2 text-sm">
                적용 무게: <span className="font-bold text-lg">{result.chargeableWeightKg.toFixed(2)}kg</span>
                <span className="text-muted-foreground ml-2">→ {result.weightBracket} 구간</span>
              </div>
            </div>

            {/* Step 4: Rate */}
            <div className={`rounded-lg p-3 ${result.exceeds20kg ? 'bg-red-50 dark:bg-red-950/30' : 'bg-green-50 dark:bg-green-950/30'}`}>
              <div className={`text-xs font-semibold mb-1 ${result.exceeds20kg ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                Step 4. FedEx 배송비 ({COUNTRY_MAP.find(c => c.code === countryCode)?.label} — {countryCode})
              </div>
              {result.exceeds20kg ? (
                <div className="text-red-600 font-bold text-lg">20kg 초과 — 별도 견적 필요</div>
              ) : result.rateKRW != null ? (
                <div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {formatKRW(result.rateKRW)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    ≈ ${result.rateUSD} USD (₩{(1350).toLocaleString()}/$ 기준)
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    * 유류할증료 미포함, VAT 별도
                  </div>
                </div>
              ) : (
                <div className="text-red-600">요율 조회 불가</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
