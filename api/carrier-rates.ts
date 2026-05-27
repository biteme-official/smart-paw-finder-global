import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Admin API token ──
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAdminToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 5 * 60 * 1000) return cachedToken;

  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN!;
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.VITE_SHOPIFY_CLIENT_ID!,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
    }),
  });
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken!;
}

async function adminGql(query: string, variables: Record<string, unknown> = {}) {
  const token = await getAdminToken();
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN!;
  const res = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()).data;
}

// ── Box specs (cm) ──
const BOXES = [
  { name: '1호', w: 22, d: 15, h: 10 },
  { name: '2호', w: 26, d: 22, h: 12 },
  { name: '3호', w: 36, d: 30, h: 14 },
  { name: '4호', w: 36, d: 30, h: 21 },
  { name: '5호', w: 45, d: 30, h: 24 },
  { name: '6호', w: 62, d: 44, h: 21 },
  { name: '7호', w: 60, d: 40, h: 40 },
  { name: '기타', w: 70, d: 50, h: 50 },
];

function selectBox(totalVolCm3: number) {
  for (const box of BOXES) {
    if (box.w * box.d * box.h >= totalVolCm3) return box;
  }
  return BOXES[BOXES.length - 1];
}

// ── Country → FedEx zone ──
type Zone = 'A'|'D'|'E'|'F'|'G'|'H'|'I'|'J'|'K'|'M'|'N'|'O'|'P'|'Q'|'R'|'S'|'T'|'U'|'V'|'W'|'X'|'Y';

const US_WEST_STATES = new Set(['CA','OR','WA','NV','AZ','UT','CO','NM','HI','AK','ID','MT','WY']);

function countryToZone(countryCode: string, province?: string): Zone | null {
  const map: Record<string, Zone> = {
    KH: 'D', LA: 'D', MN: 'D',
    GB: 'F', DE: 'F', FR: 'F',
    CA: 'H',
    GR: 'J', CH: 'J',
    RU: 'K',
    VN: 'N',
    IN: 'O',
    JP: 'P',
    MY: 'Q',
    TH: 'R',
    PH: 'S',
    ID: 'T',
    AU: 'U',
    NZ: 'V',
    HK: 'W',
    CN: 'X',
    TW: 'Y', SG: 'Y',
  };
  if (countryCode === 'US') {
    return US_WEST_STATES.has(province?.toUpperCase() || '') ? 'G' : 'I';
  }
  return map[countryCode] || 'M';
}

// ── FedEx rate table (KRW) — [maxKg, {zone: rate}] ──
const RATES: [number, Record<Zone, number>][] = [
  [0.5,  {A:32130,D:45750,E:20710,F:21180,G:28240,H:30200,I:45390,J:30400,K:25420,M:25120,N:19830,O:24260,P:22960,Q:20660,R:20400,S:22090,T:32940,U:27820,V:19690,W:25420,X:21990,Y:17130}],
  [1,    {A:34330,D:55530,E:23490,F:23920,G:32580,H:35640,I:54310,J:37930,K:26830,M:28710,N:21160,O:32320,P:24360,Q:23590,R:23010,S:24150,T:35580,U:31410,V:22560,W:26780,X:23200,Y:18560}],
  [1.5,  {A:37680,D:60380,E:25660,F:26040,G:36910,H:41110,I:64350,J:44480,K:27900,M:33040,N:21750,O:37390,P:25640,Q:25950,R:23890,S:25800,T:39440,U:31410,V:23960,W:27920,X:24280,Y:21140}],
  [2,    {A:40020,D:66270,E:27810,F:28150,G:41400,H:46840,I:71660,J:49350,K:29620,M:37050,N:23220,O:41050,P:27380,Q:27700,R:25500,S:27540,T:42090,U:33970,V:25440,W:29800,X:25800,Y:22450}],
  [2.5,  {A:42340,D:72040,E:29880,F:30140,G:45780,H:52420,I:78640,J:54020,K:31350,M:40980,N:24690,O:44620,P:29070,Q:29470,R:27130,S:29290,T:44780,U:36380,V:26910,W:31700,X:27300,Y:23760}],
  [3,    {A:44480,D:77730,E:47580,F:47550,G:50850,H:58060,I:87500,J:55120,K:32940,M:44420,N:26190,O:53420,P:30780,Q:31260,R:28770,S:31060,T:47490,U:39640,V:28280,W:33630,X:28680,Y:24970}],
  [3.5,  {A:46630,D:83420,E:51380,F:51460,G:54970,H:63360,I:96380,J:60700,K:34520,M:48020,N:27690,O:57320,P:32490,Q:33040,R:30420,S:32840,T:50200,U:42910,V:29650,W:35550,X:30060,Y:26170}],
  [4,    {A:48780,D:89110,E:55180,F:55390,G:59100,H:68650,I:105270,J:66280,K:36120,M:51630,N:29180,O:61230,P:34200,Q:34830,R:32060,S:34620,T:52920,U:46170,V:31000,W:37470,X:31440,Y:27370}],
  [4.5,  {A:50910,D:94780,E:58980,F:59300,G:63210,H:73940,I:114160,J:71880,K:37700,M:55230,N:30680,O:65140,P:35900,Q:36620,R:33700,S:36390,T:55640,U:49450,V:32370,W:39390,X:32820,Y:28570}],
  [5,    {A:53060,D:100470,E:62780,F:63220,G:67330,H:79230,I:123040,J:77460,K:39280,M:58830,N:32180,O:69040,P:37620,Q:38400,R:35350,S:38170,T:58350,U:52710,V:33730,W:41310,X:34210,Y:29780}],
  [5.5,  {A:54970,D:100470,E:69260,F:69780,G:74200,H:87440,I:132010,J:83290,K:39440,M:67180,N:39000,O:70740,P:44160,Q:43590,R:45750,S:40810,T:58770,U:62890,V:35820,W:41430,X:39450,Y:32230}],
  [6,    {A:56770,D:104940,E:72970,F:73440,G:78210,H:92490,I:140240,J:88470,K:40720,M:70820,N:40360,O:73880,P:45690,Q:45100,R:47350,S:42240,T:60810,U:66190,V:36990,W:42870,X:40750,Y:33280}],
  [6.5,  {A:58580,D:109400,E:76660,F:77110,G:82220,H:97530,I:148480,J:93660,K:42020,M:74440,N:41720,O:77020,P:47230,Q:46630,R:48940,S:43650,T:62860,U:69490,V:38170,W:44310,X:42040,Y:34350}],
  [7,    {A:60380,D:113850,E:80370,F:80770,G:86230,H:102580,I:156720,J:98850,K:43320,M:78080,N:43080,O:80160,P:48760,Q:48140,R:50540,S:45070,T:64900,U:72800,V:39340,W:45750,X:43340,Y:35410}],
  [7.5,  {A:62190,D:118320,E:84080,F:84430,G:90240,H:107620,I:164950,J:104040,K:44610,M:81720,N:44430,O:83300,P:50300,Q:49660,R:52120,S:46500,T:66960,U:76100,V:40520,W:47190,X:44640,Y:36460}],
  [8,    {A:63990,D:122780,E:87780,F:88090,G:94260,H:112660,I:173190,J:109220,K:45910,M:85340,N:45790,O:86440,P:51840,Q:51180,R:53720,S:47910,T:69000,U:79400,V:41700,W:48640,X:45930,Y:37520}],
  [8.5,  {A:65800,D:127230,E:91480,F:91750,G:98260,H:117720,I:181420,J:114400,K:47200,M:88980,N:47140,O:89580,P:53370,Q:52700,R:55320,S:49340,T:71050,U:82700,V:42870,W:50080,X:47230,Y:38580}],
  [9,    {A:67600,D:131700,E:97280,F:98250,G:109520,H:132320,I:187690,J:118300,K:48500,M:101080,N:48510,O:91820,P:54910,Q:54210,R:56910,S:50760,T:73090,U:86000,V:44050,W:51520,X:48520,Y:39640}],
  [9.5,  {A:69420,D:136160,E:101070,F:102020,G:113820,H:137770,I:195840,J:123440,K:49800,M:105060,N:49870,O:94930,P:56440,Q:55740,R:58500,S:52170,T:75140,U:89300,V:45220,W:52960,X:49820,Y:40700}],
  [10,   {A:71220,D:140610,E:104850,F:105790,G:118110,H:143200,I:204000,J:128560,K:51090,M:109020,N:51220,O:98050,P:57980,Q:57250,R:60090,S:53600,T:77180,U:92600,V:46400,W:54400,X:51120,Y:41760}],
  [10.5, {A:89120,D:164400,E:106920,F:107960,G:121740,H:147450,I:251890,J:149300,K:78880,M:112420,N:72150,O:100510,P:107730,Q:77460,R:95910,S:72990,T:94520,U:152280,V:72760,W:78070,X:83610,Y:70960}],
  [11,   {A:91220,D:168280,E:120370,F:119440,G:136270,H:166150,I:275440,J:149300,K:80740,M:125730,N:74590,O:102970,P:110070,Q:80070,R:99150,S:75460,T:97710,U:156460,V:74470,W:80710,X:85580,Y:72630}],
  [11.5, {A:93310,D:172170,E:123420,F:122640,G:140910,H:171640,I:284180,J:154110,K:82590,M:130020,N:77020,O:105340,P:112420,Q:82690,R:102390,S:77920,T:100900,U:160650,V:76170,W:83350,X:87540,Y:74290}],
  [12,   {A:95400,D:176060,E:126450,F:125840,G:145560,H:177140,I:292920,J:158920,K:84440,M:134310,N:79460,O:107720,P:114760,Q:85300,R:105630,S:80380,T:104110,U:164840,V:77890,W:85980,X:89500,Y:75960}],
  [12.5, {A:97500,D:179950,E:129500,F:129030,G:150200,H:182640,I:301650,J:163750,K:86300,M:138600,N:81900,O:110110,P:117120,Q:87920,R:108870,S:82860,T:107300,U:169030,V:79590,W:88620,X:91460,Y:77620}],
  [13,   {A:99580,D:183840,E:132550,F:132240,G:154840,H:188140,I:310390,J:168560,K:88150,M:142880,N:84340,O:112480,P:119460,Q:90540,R:112110,S:85320,T:110490,U:173220,V:81300,W:91260,X:93430,Y:79290}],
  [13.5, {A:101670,D:187720,E:135580,F:135430,G:159490,H:193640,I:319120,J:173380,K:90000,M:147160,N:86780,O:114860,P:121800,Q:93150,R:115350,S:87790,T:113680,U:177400,V:83010,W:93900,X:95400,Y:80960}],
  [14,   {A:103770,D:191610,E:138630,F:138630,G:164130,H:199140,I:327860,J:178200,K:91860,M:151450,N:89220,O:117240,P:124150,Q:95770,R:118590,S:90250,T:116880,U:181590,V:84720,W:96520,X:97350,Y:82620}],
  [14.5, {A:105860,D:195500,E:141680,F:141820,G:168780,H:204630,I:336600,J:183010,K:93700,M:155730,N:91650,O:119620,P:126490,Q:98380,R:121830,S:92720,T:120070,U:185790,V:86420,W:99160,X:99320,Y:84280}],
  [15,   {A:107950,D:199390,E:144720,F:145030,G:173420,H:210140,I:345330,J:187830,K:95550,M:160020,N:94090,O:122000,P:128840,Q:101000,R:125070,S:95180,T:123260,U:189980,V:88140,W:101800,X:101280,Y:85950}],
  [15.5, {A:110050,D:203280,E:147760,F:148220,G:178060,H:215640,I:354070,J:192640,K:97410,M:164300,N:96520,O:124380,P:131180,Q:103620,R:128310,S:97650,T:126450,U:194170,V:89840,W:104440,X:103240,Y:87620}],
  [16,   {A:112140,D:207160,E:150810,F:151420,G:182710,H:221130,I:362800,J:197470,K:99260,M:168580,N:98960,O:126750,P:133530,Q:106230,R:131550,S:100110,T:129640,U:198360,V:91540,W:107070,X:105200,Y:89290}],
  [16.5, {A:114240,D:211050,E:171120,F:168370,G:198320,H:241950,I:362860,J:197560,K:101110,M:183100,N:101400,O:126790,P:135870,Q:108850,R:134790,S:102580,T:132840,U:202540,V:93260,W:109710,X:107170,Y:90960}],
  [17,   {A:116320,D:214940,E:174500,F:171850,G:203230,H:247820,I:371400,J:202270,K:102970,M:187640,N:103830,O:129120,P:138220,Q:111460,R:138030,S:105040,T:136030,U:206730,V:94960,W:112350,X:109120,Y:92610}],
  [17.5, {A:118410,D:218830,E:177880,F:175340,G:208150,H:253690,I:379930,J:206970,K:104820,M:192180,N:106280,O:131460,P:140560,Q:114080,R:141270,S:107520,T:139220,U:210920,V:96670,W:114990,X:111090,Y:94280}],
  [18,   {A:120510,D:222720,E:181270,F:178820,G:213070,H:259560,I:388460,J:211680,K:106660,M:196710,N:108720,O:133780,P:142920,Q:116700,R:144510,S:109980,T:142420,U:215110,V:98380,W:117620,X:113060,Y:95950}],
  [18.5, {A:122600,D:226600,E:184650,F:182300,G:217980,H:265440,I:396990,J:216380,K:108520,M:201260,N:111150,O:136120,P:145260,Q:119310,R:147750,S:112450,T:145620,U:219300,V:100090,W:120260,X:115020,Y:97620}],
  [19,   {A:124690,D:230490,E:188050,F:185780,G:222900,H:271300,I:405520,J:221080,K:110370,M:205800,N:113590,O:138460,P:147600,Q:121930,R:150990,S:114910,T:148810,U:223480,V:101790,W:122900,X:116980,Y:99280}],
  [19.5, {A:126790,D:234380,E:191430,F:189260,G:227820,H:277170,I:414060,J:225790,K:112220,M:210330,N:116020,O:140790,P:149950,Q:124540,R:154230,S:117380,T:152000,U:227680,V:103510,W:125540,X:118940,Y:100940}],
  [20,   {A:128880,D:238270,E:194820,F:192750,G:232720,H:283040,I:422590,J:230490,K:114080,M:214870,N:118460,O:143130,P:152290,Q:127170,R:157470,S:119840,T:155190,U:231870,V:105210,W:128180,X:120910,Y:102610}],
];

function lookupRate(kg: number, zone: Zone): number | null {
  for (const [limit, rates] of RATES) {
    if (kg <= limit) return rates[zone];
  }
  return null;
}

// ── Fetch variant dimensions from metafields ──
async function fetchVariantDimensions(variantIds: string[]): Promise<Map<string, { w: number; d: number; h: number }>> {
  const result = new Map<string, { w: number; d: number; h: number }>();
  if (variantIds.length === 0) return result;

  // Batch query — max 50 at a time
  for (let i = 0; i < variantIds.length; i += 50) {
    const batch = variantIds.slice(i, i + 50);
    const ids = batch.map(id => `"gid://shopify/ProductVariant/${id}"`).join(',');

    const data = await adminGql(`{
      nodes(ids: [${ids}]) {
        ... on ProductVariant {
          id
          metafields(first: 5, namespace: "shipping") {
            edges { node { key value } }
          }
        }
      }
    }`);

    for (const node of data?.nodes || []) {
      if (!node?.metafields) continue;
      const metas = node.metafields.edges.map((e: any) => e.node);
      const w = parseFloat(metas.find((m: any) => m.key === 'width')?.value || '0');
      const d = parseFloat(metas.find((m: any) => m.key === 'depth')?.value || '0');
      const h = parseFloat(metas.find((m: any) => m.key === 'height')?.value || '0');
      if (w > 0 && d > 0 && h > 0) {
        const numericId = node.id.replace('gid://shopify/ProductVariant/', '');
        // Metafield values are in mm, convert to cm
        result.set(numericId, { w: w / 10, d: d / 10, h: h / 10 });
      }
    }
  }

  return result;
}

const KRW_TO_USD = 1350;

// ── Handler ──
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rate } = req.body || {};
    if (!rate) return res.status(400).json({ rates: [] });

    const items: any[] = rate.items || [];
    const dest = rate.destination || {};
    const country = dest.country || '';
    const province = dest.province || '';

    console.log('[Carrier Rates] country:', country, 'items:', items.length);

    // Step 1: Determine FedEx zone
    const zone = countryToZone(country, province);
    console.log('[Carrier Rates] zone:', zone);

    // Step 2: Calculate weight from Shopify grams (no Admin API call needed)
    let totalWeightKg = 0;
    for (const item of items) {
      totalWeightKg += (item.grams || 0) / 1000 * item.quantity;
    }
    const chargeableKg = Math.max(totalWeightKg, 0.5);
    console.log('[Carrier Rates] weight:', chargeableKg, 'kg');

    // Step 3: Try to fetch dimensions for volumetric weight (optional, non-blocking)
    let finalKg = chargeableKg;
    let boxName = '';
    try {
      const variantIds = items.map((item: any) => String(item.variant_id)).filter(Boolean);
      const dimsMap = await fetchVariantDimensions(variantIds);

      let totalVolCm3 = 0;
      for (const item of items) {
        const dims = dimsMap.get(String(item.variant_id));
        if (dims) totalVolCm3 += dims.w * dims.d * dims.h * item.quantity;
      }

      if (totalVolCm3 > 0) {
        const box = selectBox(totalVolCm3);
        const boxVolKg = (box.w * box.d * box.h) / 5000;
        finalKg = Math.max(boxVolKg, totalWeightKg);
        boxName = box.name;
        console.log('[Carrier Rates] box:', boxName, 'volKg:', boxVolKg, 'finalKg:', finalKg);
      }
    } catch (dimErr: any) {
      console.warn('[Carrier Rates] Dimension lookup failed, using weight only:', dimErr.message);
    }

    // Step 4: Lookup rate (cap at 20kg for table, flag if over)
    const cappedKg = Math.min(finalKg, 20);
    const isOver20 = finalKg > 20;
    if (isOver20) console.log('[Carrier Rates] Over 20kg, capping to 20kg for rate lookup');

    const rateKRW = zone ? lookupRate(cappedKg, zone) : null;
    const rateUSD = rateKRW ? Math.ceil(rateKRW / KRW_TO_USD) : 50;
    const overNote = isOver20 ? ' (20kg+, contact for exact quote)' : '';
    const serviceName = boxName
      ? `FedEx International Priority — ${boxName}, ${finalKg.toFixed(1)}kg${overNote}`
      : `FedEx International Priority — ${finalKg.toFixed(1)}kg${overNote}`;

    console.log('[Carrier Rates] rate:', rateUSD, 'USD');

    return res.status(200).json({
      rates: [{
        service_name: serviceName,
        service_code: 'fedex_b2b',
        total_price: rateUSD * 100,
        currency: 'USD',
        min_delivery_date: null,
        max_delivery_date: null,
      }],
    });
  } catch (err: any) {
    console.error('[Carrier Rates] FATAL:', err.message, err.stack);
    // Return fallback rate instead of empty (empty = "shipping not available")
    return res.status(200).json({
      rates: [{
        service_name: 'FedEx International Priority',
        service_code: 'fedex_b2b_fallback',
        total_price: 5000,
        currency: 'USD',
        min_delivery_date: null,
        max_delivery_date: null,
      }],
    });
  }
}
